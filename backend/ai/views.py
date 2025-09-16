from rest_framework import permissions, views, status
from rest_framework.response import Response
import os
import requests
from pathlib import Path
from assessments.models import Assessment
from rest_framework import serializers

def _get_ai_api_key() -> str | None:
    key = os.getenv('OPENROUTER_API_KEY') or os.getenv('OPENAI_API_KEY')
    if key:
        return key
    try:
        # Prefer key stored alongside this file: backend/ai/openrouter.key
        ai_dir = Path(__file__).resolve().parent
        ai_key_path = ai_dir / 'openrouter.key'
        if ai_key_path.exists():
            return ai_key_path.read_text(encoding='utf-8').strip()
        # Fallback to backend/openrouter.key
        backend_dir = ai_dir.parent
        backend_key_path = backend_dir / 'openrouter.key'
        if backend_key_path.exists():
            return backend_key_path.read_text(encoding='utf-8').strip()
    except Exception:
        pass
    return None


class AIRecommendView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        prompt = request.data.get('prompt') or 'öğrenci için kariyer öner'
        api_key = _get_ai_api_key()
        if api_key:
            try:
                provider_url = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                    'X-Title': os.getenv('OPENROUTER_TITLE', 'E-Teacher'),
                }
                payload = {
                    'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                    'messages': [ { 'role': 'user', 'content': prompt } ],
                    'temperature': 0.2,
                    'max_tokens': 600,
                }
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=15)
                if resp.ok:
                    content = resp.json().get('choices', [{}])[0].get('message', {}).get('content') or f"AI öneri: {prompt}"
                    return Response({ 'result': content })
                return Response({ 'result': f'mock: {prompt}' })
            except Exception as e:
                return Response({ 'result': f'mock: {prompt}', 'error': str(e) }, status=status.HTTP_200_OK)
        return Response({ 'result': f'mock: {prompt}' })


class AISummarizeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        text = request.data.get('text') or ''
        api_key = _get_ai_api_key()
        if api_key and text:
            try:
                provider_url = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                    'X-Title': os.getenv('OPENROUTER_TITLE', 'E-Teacher'),
                }
                prompt = f"Şu metni kısa ve maddeler halinde özetle (TR):\n\n{text}"
                payload = {
                    'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                    'messages': [ { 'role': 'user', 'content': prompt + '\nSadece düz metin döndür.' } ],
                    'temperature': 0.2,
                    'max_tokens': 800,
                }
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=20)
                if resp.ok:
                    content = resp.json().get('choices', [{}])[0].get('message', {}).get('content') or ''
                    return Response({ 'summary': content or text[:200] })
                return Response({ 'summary': f'mock: {text[:200]}' })
            except Exception as e:
                return Response({ 'summary': f'mock: {text[:200]}', 'error': str(e) }, status=status.HTTP_200_OK)
        return Response({ 'summary': f'mock: {text[:200]}' })


class AIStudyScheduleView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        courses = (request.data.get('courses') or '').strip()
        subjects = request.data.get('subjects') or []  # [{name, hours}]
        available_days = request.data.get('available_days') or ['Pzt','Sal','Çar','Per','Cum']

        # Try to use last quiz stats to bias schedule
        last_quiz = Assessment.objects.filter(user=request.user, title__icontains='QuizResult').order_by('-created_at').first()
        weak_topics: list[str] = []
        if last_quiz:
            data = last_quiz.data or {}
            topics = (data.get('topics') or '').strip()
            weak_topics = [t.strip() for t in topics.split(',') if t.strip()]

        base_schedule = [
            { 'day': 'Pzt', 'items': [] },
            { 'day': 'Sal', 'items': [] },
            { 'day': 'Çar', 'items': [] },
            { 'day': 'Per', 'items': [] },
            { 'day': 'Cum', 'items': [] },
            { 'day': 'Cmt', 'items': [] },
            { 'day': 'Paz', 'items': [] },
        ]

        # Build a subject queue, prioritizing weak topics and higher hours
        subj_list: list[tuple[str,int]] = []
        try:
            for s in subjects:
                name = (s.get('name') or '').strip()
                hours = int(s.get('hours') or 0)
                if name and hours > 0:
                    subj_list.append((name, hours))
        except Exception:
            pass
        if not subj_list:
            # fallback to simple parsing from courses string
            fallback = [s.strip() for s in (courses or '').split(',') if s.strip()] or ['Genel Çalışma']
            subj_list = [(n, 1) for n in fallback]

        # Sort: weak topics first
        def priority(name: str) -> int:
            try:
                return -weak_topics.index(name)  # earlier index -> higher prio
            except ValueError:
                return -999
        subj_list.sort(key=lambda x: (priority(x[0]), -x[1]))

        # Allocate one-hour blocks across available days, from 17:00 to 20:00 then 16:00,15:00...
        preferred_hours = [17, 18, 19, 16, 15, 14, 13, 12, 11, 10, 9, 8]
        day_to_idx = { row['day']: i for i, row in enumerate(base_schedule) }
        alloc = 0
        for name, hours_needed in subj_list:
            h_left = hours_needed
            # round-robin over available days
            for d in available_days:
                if h_left <= 0:
                    break
                if d not in day_to_idx:
                    continue
                di = day_to_idx[d]
                # pick first free preferred hour for that day
                for hr in preferred_hours:
                    slot = f"{name} {str(hr).zfill(2)}:00-{str(hr+1).zfill(2)}:00"
                    # avoid duplicate hour in same day
                    if any(it.endswith(f"{str(hr).zfill(2)}:00-{str(hr+1).zfill(2)}:00") for it in base_schedule[di]['items']):
                        continue
                    base_schedule[di]['items'].append(slot)
                    h_left -= 1
                    alloc += 1
                    if h_left <= 0:
                        break
            # if still left, place on other days
            if h_left > 0:
                for di in range(len(base_schedule)):
                    for hr in preferred_hours:
                        if h_left <= 0:
                            break
                        slot = f"{name} {str(hr).zfill(2)}:00-{str(hr+1).zfill(2)}:00"
                        if any(it.endswith(f"{str(hr).zfill(2)}:00-{str(hr+1).zfill(2)}:00") for it in base_schedule[di]['items']):
                            continue
                        base_schedule[di]['items'].append(slot)
                        h_left -= 1
                    if h_left <= 0:
                        break

        return Response({ 'schedule': base_schedule })


class AIQuizGenerateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        topics = request.data.get('topics', '')
        try:
            num_questions = int(request.data.get('num_questions', 10))
        except Exception:
            num_questions = 10
        difficulty = request.data.get('difficulty', 'orta')

        api_key = _get_ai_api_key()
        questions = []

        if api_key and topics:
            try:
                provider_url = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                    'X-Title': os.getenv('OPENROUTER_TITLE', 'E-Teacher'),
                }
                prompt = (
                    "Türkçe çoktan seçmeli bir quiz üret ve SADECE JSON yanıt ver. "
                    "Şema: {\n  \"questions\": [\n    { \"q\": string, \"a\": [string,string,string,string], \"correct\": string, \"explanation\": string }\n  ]\n}. "
                    f"Konu: {topics}. Zorluk: {difficulty}. Soru sayısı: {num_questions}. "
                    "'correct' alanı \"a\" listesindeki şıklardan birebir biri olmalı. Markdown koyma."
                )
                payload = {
                    'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                    'messages': [ { 'role': 'user', 'content': prompt } ],
                    'response_format': { 'type': 'json_object' },
                    'temperature': 0.2,
                    'max_tokens': 1200,
                }
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=30)
                if resp.ok:
                    data_json = resp.json()
                    message = (data_json.get('choices') or [{}])[0].get('message', {})
                    content = (
                        message.get('content')
                        or message.get('parsed')
                        or (message.get('tool_calls') or [{}])[0].get('function', {}).get('arguments')
                        or ''
                    )
                    import json, re
                    qs = []
                    if isinstance(content, dict):
                        qs = content.get('questions', [])
                    else:
                        try:
                            data = json.loads(content)
                            qs = data.get('questions', [])
                        except Exception:
                            m = re.search(r"\{[\s\S]*\}", str(content))
                            if m:
                                try:
                                    data = json.loads(m.group(0))
                                    qs = data.get('questions', [])
                                except Exception:
                                    qs = []
                    for q in qs:
                        qtext = q.get('q')
                        opts = q.get('a') or []
                        correct = q.get('correct')
                        if isinstance(correct, int):
                            try:
                                correct = opts[correct]
                            except Exception:
                                correct = None
                        if qtext and isinstance(opts, list) and len(opts) >= 2 and correct in opts:
                            questions.append({
                                'q': qtext,
                                'a': opts[:4],
                                'correct': correct,
                                'explanation': q.get('explanation', ''),
                            })
                # if non-200, ignore and use fallback
            except Exception:
                pass

        if not questions:
            questions = [
                { 'q': f'Soru {i+1}: {topics} ile ilgili...', 'a': ['Seçenek A','Seçenek B','Seçenek C','Seçenek D'], 'correct': 'Seçenek A', 'explanation': '' }
                for i in range(num_questions)
            ]

        Assessment.objects.create(
            user=request.user,
            title='Quiz',
            score=0,
            data={ 'topics': topics, 'difficulty': difficulty, 'questions': questions }
        )
        return Response({ 'questions': questions })


class AIReportGenerateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        notes = request.data.get('notes', '')
        date = request.data.get('date', '')
        summary = f'Rapor özeti: {notes[:140]}'
        metrics = { 'math': 72, 'physics': 55, 'chemistry': 63 }
        assessment = Assessment.objects.create(user=request.user, title=f'Rapor {date or "bugün"}', score=0, data={ 'summary': summary, 'metrics': metrics })
        return Response({ 'summary': summary, 'metrics': metrics })


class AIExamAnalysisView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        exam_type = request.data.get('exam_type', 'TYT')
        subjects = request.data.get('subjects', [])  # [{name, net, blank, wrong}]
        goals = request.data.get('goals', '')

        api_key = _get_ai_api_key()
        result = {
            'topics_to_focus': [],
            'study_plan': [],
            'tips': []
        }
        if api_key and subjects:
            try:
                provider_url = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                    'X-Title': os.getenv('OPENROUTER_TITLE', 'E-Teacher'),
                }
                import json
                prompt = (
                    "Aşağıdaki öğrenci sınav sonuçlarını analiz et ve SADECE JSON yanıt ver. "
                    "Şema: {\n  \"topics_to_focus\": [string],\n  \"study_plan\": [string],\n  \"tips\": [string]\n}. "
                    f"Sınav: {exam_type}. Hedefler: {goals}. Sonuçlar: {json.dumps(subjects, ensure_ascii=False)}."
                )
                payload = {
                    'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                    'messages': [ { 'role': 'user', 'content': prompt } ],
                    'response_format': { 'type': 'json_object' },
                    'temperature': 0.2,
                    'max_tokens': 1000,
                }
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=25)
                if resp.ok:
                    data = resp.json().get('choices', [{}])[0].get('message', {}).get('content') or '{}'
                    try:
                        parsed = json.loads(data)
                    except Exception:
                        parsed = {}
                    result['topics_to_focus'] = parsed.get('topics_to_focus') or []
                    result['study_plan'] = parsed.get('study_plan') or []
                    result['tips'] = parsed.get('tips') or []
            except Exception:
                pass

        if not any([result['topics_to_focus'], result['study_plan'], result['tips']]):
            result = {
                'topics_to_focus': [s.get('name', 'Ders') for s in subjects[:3]],
                'study_plan': [
                    'Hafta içi her gün 1 saat konu tekrarı',
                    'Hafta sonu 2 deneme sınavı ve yanlış analizi',
                ],
                'tips': [
                    'Yanlış yaptığın konu başlıklarını not al ve tekrar et',
                    'Netini artırmak için düzenli deneme çöz',
                ]
            }

        Assessment.objects.create(
            user=request.user,
            title=f'ExamAnalysis {exam_type}',
            score=0,
            data={ 'exam_type': exam_type, 'subjects': subjects, 'result': result }
        )
        return Response(result)


class AIPsychSupportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    class _Serializer(serializers.Serializer):
        message = serializers.CharField(allow_blank=True, required=False)
        mood = serializers.CharField(allow_blank=True, required=False)
        history = serializers.ListField(child=serializers.DictField(), required=False)

    def post(self, request):
        ser = self._Serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        message = ser.validated_data.get('message') or ''
        mood = ser.validated_data.get('mood') or ''
        history = ser.validated_data.get('history') or []
        api_key = _get_ai_api_key()
        if api_key and (message or mood):
            try:
                provider_url = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                    'X-Title': os.getenv('OPENROUTER_TITLE', 'E-Teacher'),
                }
                # Build messages array for chat with short system prompt
                msgs = [{ 'role': 'system', 'content': 'Kısa, nazik ve pratik destek ver. Klinik teşhis koyma. 4-6 maddelik öneriler ekle. Türkçe yaz.' }]
                # include brief history if provided
                for m in history[-6:]:
                    role = m.get('role') in ('user','assistant') and m.get('role') or 'user'
                    content = m.get('content') or ''
                    if content:
                        msgs.append({ 'role': role, 'content': content })
                user_prompt = f"Duygu/Hal: {mood}\nMesaj: {message}"
                msgs.append({ 'role': 'user', 'content': user_prompt })
                payload = {
                    'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                    'messages': msgs,
                    'temperature': 0.3,
                    'max_tokens': 600,
                }
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=15)
                if resp.ok:
                    content = resp.json().get('choices', [{}])[0].get('message', {}).get('content') or ''
                    # log assessment
                    try:
                        Assessment.objects.create(user=request.user, title='PsychSupportChat', score=0, data={ 'mood': mood, 'message': message, 'reply': content })
                    except Exception:
                        pass
                    return Response({ 'support': content })
            except Exception:
                pass
        # Fallback
        fallback = (
            "Merhaba, hislerini paylaşman çok değerli. Küçük adımlarla ilerleyebilirsin.\n"
            "- 4x4 nefes egzersizi yap\n- 25 dk odak + 5 dk mola (Pomodoro)\n"
            "- Su iç ve kısa bir yürüyüş yap\n- Bugün için tek bir küçük hedef belirle"
        )
        try:
            Assessment.objects.create(user=request.user, title='PsychSupportChat', score=0, data={ 'mood': mood, 'message': message, 'reply': fallback })
        except Exception:
            pass
        return Response({ 'support': fallback })


class AIChatView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    class _Serializer(serializers.Serializer):
        message = serializers.CharField()
        history = serializers.ListField(child=serializers.DictField(), required=False)

    def post(self, request):
        ser = self._Serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        message = ser.validated_data['message']
        history = ser.validated_data.get('history') or []
        api_key = _get_ai_api_key()
        if api_key and message:
            try:
                provider_url = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                    'X-Title': os.getenv('OPENROUTER_TITLE', 'E-Teacher'),
                }
                msgs = [{'role': 'system', 'content': 'Yardımcı, açıklayıcı ve kısa yanıtlar ver. Türkçe cevapla.'}]
                for m in history[-12:]:
                    role = m.get('role') in ('user','assistant') and m.get('role') or 'user'
                    content = m.get('content') or ''
                    if content:
                        msgs.append({'role': role, 'content': content})
                msgs.append({'role': 'user', 'content': message})
                payload = {
                    'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                    'messages': msgs,
                    'temperature': 0.3,
                    'max_tokens': 700,
                }
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=20)
                if resp.ok:
                    content = resp.json().get('choices', [{}])[0].get('message', {}).get('content') or ''
                    return Response({ 'reply': content })
            except Exception:
                pass
        # Fallback
        fallback = 'Şu an yanıt veremiyorum. Birazdan tekrar dener misin?'
        return Response({ 'reply': fallback })


class AIChatSaveThreadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    class _Serializer(serializers.Serializer):
        title = serializers.CharField(required=False, allow_blank=True)
        history = serializers.ListField(child=serializers.DictField())

    def post(self, request):
        ser = self._Serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        title = ser.validated_data.get('title') or 'ChatThread'
        history = ser.validated_data['history']
        a = Assessment.objects.create(user=request.user, title=title, score=0, data={ 'history': history })
        return Response({ 'ok': True, 'id': a.id, 'created_at': a.created_at })
