from rest_framework import permissions, views, status
from rest_framework.response import Response
import os
import requests
from pathlib import Path
from assessments.models import Assessment

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
        courses = request.data.get('courses', '')
        availability = request.data.get('availability', '')
        schedule = [
            { 'day': 'Pzt', 'items': ['Math 18:00-19:00', 'Fizik 19:15-20:00'] },
            { 'day': 'Sal', 'items': ['Kimya 18:00-19:00'] },
            { 'day': 'Çar', 'items': ['Tarih 18:00-19:00', 'Biyoloji 19:15-20:00'] },
            { 'day': 'Per', 'items': [] },
            { 'day': 'Cum', 'items': ['Deneme Sınavı 18:00-19:30'] },
            { 'day': 'Cmt', 'items': ['Genel Tekrar 14:00-15:30'] },
            { 'day': 'Paz', 'items': ['Dinlenme'] },
        ]
        return Response({ 'schedule': schedule })


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
