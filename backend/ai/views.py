from rest_framework import permissions, views, status
from rest_framework.response import Response
import os
import requests
import random
import uuid
from datetime import datetime, timedelta
from pathlib import Path
from assessments.models import Assessment
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import serializers
from typing import Dict, Any, List, Optional, Union

def randomize_quiz_options(question_data: Dict[str, Any]) -> Dict[str, Any]:
    if not question_data or 'a' not in question_data or 'correct' not in question_data:
        return question_data
    
    options = question_data['a'].copy()
    correct_answer = question_data['correct']
    
    if correct_answer in options:
        random.shuffle(options)
        return {
            **question_data,
            'a': options,
            'correct': correct_answer
        }
    
    return question_data

def _get_ai_api_key() -> str | None:
    key = os.getenv('OPENROUTER_API_KEY') or os.getenv('OPENAI_API_KEY')
    if key:
        return key
    try:
        ai_dir = Path(__file__).resolve().parent
        ai_key_path = ai_dir / 'openrouter.key'
        if ai_key_path.exists():
            return ai_key_path.read_text(encoding='utf-8').strip()
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
        
        tyt_target = request.data.get('tyt_target', '')
        ayt_target = request.data.get('ayt_target', '')
        ranking_goal = request.data.get('ranking_goal', '')
        subjects_interest = request.data.get('subjects_interest', [])
        
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
                
                enhanced_prompt = self._create_career_recommendation_prompt(
                    prompt, tyt_target, ayt_target, ranking_goal, subjects_interest
                )
                
                payload = {
                    'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                    'messages': [ { 'role': 'user', 'content': enhanced_prompt } ],
                    'response_format': { 'type': 'json_object' },
                    'temperature': 0.3,
                    'max_tokens': 1000,
                }
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=12)
                if resp.ok:
                    response_data = resp.json()
                    content = response_data.get('choices', [{}])[0].get('message', {}).get('content') or '{}'
                    
                    try:
                        import json
                        parsed_content = json.loads(content)
                        return Response({
                            'result': parsed_content.get('recommendation', f"AI öneri: {prompt}"),
                            'tyt_requirement': parsed_content.get('tyt_requirement', 'Belirlenmedi'),
                            'ayt_requirement': parsed_content.get('ayt_requirement', 'Belirlenmedi'),
                            'subject_nets': parsed_content.get('subject_nets', {}),
                            'ranking_analysis': parsed_content.get('ranking_analysis', 'Analiz yapılamadı'),
                            'study_tips': parsed_content.get('study_tips', [])
                        })
                    except:
                        return Response({ 'result': content or f"AI öneri: {prompt}" })
                return Response({ 'result': f'mock: {prompt}' })
            except Exception as e:
                return Response({ 'result': f'mock: {prompt}', 'error': str(e) }, status=status.HTTP_200_OK)
        return Response({ 'result': f'mock: {prompt}' })
    
    def _create_career_recommendation_prompt(self, base_prompt, tyt_target, ayt_target, ranking_goal, subjects_interest):
        current_time = datetime.now().strftime('%Y%m%d%H%M%S')
        random_seed = uuid.uuid4().hex[:8]
        
        # Try to extract specific career goal from the prompt
        career_goal = ""
        if "doktor" in base_prompt.lower():
            career_goal = "doktor"
        elif "öğretmen" in base_prompt.lower():
            career_goal = "öğretmen"
        elif "mühendis" in base_prompt.lower():
            career_goal = "mühendis"
        elif "avukat" in base_prompt.lower():
            career_goal = "avukat"
        elif "psikolog" in base_prompt.lower():
            career_goal = "psikolog"
        
        enhanced_prompt = (
            f"KARİYER ÖNERİSİ VE TYT/AYT HEDEFLEMESİ\n\n"
            f"ÖĞRENCİ PROFİLİ:\n"
            f"- Talep: {base_prompt}\n"
            f"- TYT Hedef Net: {tyt_target or 'Belirtilmedi'}\n"
            f"- AYT Hedef Net: {ayt_target or 'Belirtilmedi'}\n"
            f"- Sıralama Hedefi: {ranking_goal or 'Belirtilmedi'}\n"
            f"- İlgi Alanları: {', '.join(subjects_interest) if subjects_interest else 'Belirtilmedi'}\n"
            f"- Hedef Meslek: {career_goal or 'Belirtilmedi'}\n\n"
            f"GÖREVLER:\n"
            f"1. Öğrenci profiline uygun kariyer önerileri ver\n"
            f"2. Hedeflenen sıralama için gereken TYT/AYT net sayılarını hesapla\n"
            f"3. Her ders için özel net hedefleri belirle\n"
            f"4. Sıralama analizini yap ve gerçekçi değerlendirme sun\n"
            f"5. Kişiselleştirilmiş çalışma önerileri ver\n"
            f"6. Hedef mesleğe göre günlük çalışma saatleri ve plan öner\n"
            f"7. Hedef mesleğe göre TYT ve AYT net dağılımı öner\n\n"
            f"ÇIKTI FORMATI - SADECE JSON:\n"
            f"{{\n"
            f'  "recommendation": "Detaylı kariyer önerisi ve açıklaması",\n'
            f'  "tyt_requirement": "Hedef için gereken TYT net (örn: 110-120)",\n'
            f'  "ayt_requirement": "Hedef için gereken AYT net (örn: 60-70)",\n'
            f'  "subject_nets": {{\n'
            f'    "matematik": "25-30",\n'
            f'    "turkce": "35-40",\n'
            f'    "fen": "20-25",\n'
            f'    "sosyal": "15-20"\n'
            f'  }},\n'
            f'  "ranking_analysis": "Sıralama analizi ve gerçekçilik değerlendirmesi",\n'
            f'  "study_tips": ["öneri1", "öneri2", "öneri3"],\n'
            f'  "daily_study_hours": "Günlük çalışma saati önerisi (örn: 6-8 saat)",\n'
            f'  "weekly_plan": "Haftalık çalışma planı önerisi"\n'
            f"}}\n\n"
            f"TYT/AYT SINAVLARI HAKKINDA BİLGİLER:\n"
            f"- TYT: Temel Yeterlilik Testi (120 soru, 135 dakika)\n"
            f"- AYT: Alan Yeterlilik Testi (80 soru, 180 dakika)\n"
            f"- En iyi 10.000: TYT 110+ AYT 65+ gerekli\n"
            f"- En iyi 50.000: TYT 95+ AYT 45+ gerekli\n"
            f"- En iyi 100.000: TYT 80+ AYT 35+ gerekli\n"
            f"- Doktor olmak için genellikle ilk 50.000 gerekir\n"
            f"- Öğretmen olmak için genellikle ilk 100.000 yeterlidir\n\n"
            f"BENZERSİZLİK: {random_seed}-{current_time}\n"
            f"GERÇEK VERİLERE DAYALI ANALİZ YAP!"
        )
        
        return enhanced_prompt


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


@method_decorator(csrf_exempt, name='dispatch')
class AIStudyScheduleView(views.APIView):
    permission_classes = [permissions.AllowAny]  # Public; CSRF-exempt for frontend POST

    def post(self, request):
        courses = (request.data.get('courses') or '').strip()
        subjects = request.data.get('subjects') or []
        available_days = request.data.get('available_days') or ['Pzt','Sal','Çar','Per','Cum']
        cell_states = request.data.get('cell_states') or {}  # {"Pzt-8": "green"|"yellow"|"red"}
        day_states = request.data.get('day_states') or {}    # {"Pzt": "green"|"yellow"|"red"}
        preferences = request.data.get('preferences', {})
        study_goals = request.data.get('goals', '')
        
        last_quiz = None
        weak_topics: list[str] = []
        strong_topics: list[str] = []
        
        if hasattr(request, 'user') and request.user.is_authenticated:
            last_quiz = Assessment.objects.filter(user=request.user, title__icontains='QuizResult').order_by('-created_at').first()  # type: ignore[attr-defined]
            if last_quiz:
                data = last_quiz.data or {}
                topics = (data.get('topics') or '').strip()
                weak_topics = [t.strip() for t in topics.split(',') if t.strip()]
                strong_topics = ['temel konular', 'alıştırmalar']

        subj_list: list[tuple[str,int]] = []
        try:
            for s in subjects:
                if isinstance(s, dict):
                    name = (s.get('name') or '').strip()
                    hours = int(s.get('hours') or 0)
                    if name and hours > 0:
                        subj_list.append((name, hours))
        except Exception:
            pass
    
        if not subj_list:
            fallback = [s.strip() for s in (courses or '').split(',') if s.strip()] or ['Genel Çalışma']
            subj_list = [(n, 2) for n in fallback]

        # Try AI-powered scheduling first if key exists
        api_key = _get_ai_api_key()
        if api_key and subj_list:
            try:
                provider_url = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                    'X-Title': os.getenv('OPENROUTER_TITLE', 'E-Teacher'),
                }
                import json
                # Compact availability summary by priority and day
                def summarize_availability():
                    days = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']
                    priorities = {'green': {}, 'yellow': {}, 'red': {}}
                    for d in days:
                        for h in range(8, 22):
                            key = f"{d}-{h}"
                            state = cell_states.get(key) or day_states.get(d)
                            if state in ('green','yellow','red'):
                                priorities[state].setdefault(d, []).append(h)
                    return { k: { d: sorted(v) for d, v in vmap.items() } for k, vmap in priorities.items() }

                availability = summarize_availability()
                prompt = (
                    "Aşağıdaki girdilere göre EN İYİ haftalık ders programını hazırla ve SADECE JSON ver.\n"
                    "Kurallar: 1) Önce yeşil saatleri doldur, bitince sarı, en son kırmızı. 2) Aynı ders çift sayıda saat ise 2'şer ardışık bloklara böl (örn 08-10).\n"
                    "3) Tek kalan saatler 1 saatlik oturum olarak uygun yerlere yerleştir. 4) Çakışma olmasın, saatler 08:00-22:00 aralığında.\n"
                    "5) Günlere dengeli dağıt, ama müsaitlik önceliğine uy. 6) Çıktı formatını birebir uygula.\n\n"
                    f"Dersler/Saatler: {json.dumps([{'name': n, 'hours': h} for n,h in subj_list], ensure_ascii=False)}\n"
                    f"Müsait Günler: {json.dumps(available_days, ensure_ascii=False)}\n"
                    f"Müsaitlik (yeşil/sarı/kırmızı): {json.dumps(availability, ensure_ascii=False)}\n"
                    "ÇIKTI ŞEMASI:\n{\n  \"schedule\": [ { \"day\": \"Pzt\", \"items\": [\"Matematik 09:00-10:00\"] } ],\n  \"tips\": [\"kısa ipucu\"]\n}"
                )
                payload = {
                    'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                    'messages': [{ 'role': 'user', 'content': prompt }],
                    'response_format': { 'type': 'json_object' },
                    'temperature': 0.2,
                    'max_tokens': 1400,
                }
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=20)
                if resp.ok:
                    data = resp.json().get('choices', [{}])[0].get('message', {}).get('content') or '{}'
                    try:
                        parsed = json.loads(data)
                        ai_schedule = parsed.get('schedule') or []
                        # Validate AI schedule
                        valid_days = {'Pzt','Sal','Çar','Per','Cum','Cmt','Paz'}
                        ok = isinstance(ai_schedule, list) and all(
                            isinstance(d.get('day'), str) and d.get('day') in valid_days and isinstance(d.get('items'), list)
                            for d in ai_schedule
                        )
                        # Count hours from schedule
                        def count_hours(items: list[str]) -> int:
                            cnt = 0
                            for it in items:
                                try:
                                    times = it.split(' ')[-1]
                                    sh = int(times.split('-')[0].split(':')[0])
                                    eh = int(times.split('-')[1].split(':')[0])
                                    cnt += max(0, eh - sh)
                                except Exception:
                                    pass
                            return cnt
                        total_needed = sum(h for _, h in subj_list)
                        total_scheduled = sum(count_hours(d.get('items') or []) for d in ai_schedule)
                        if ok and total_scheduled >= min(total_needed, 1):
                            tips = parsed.get('tips') or []
                            return Response({ 'schedule': ai_schedule, 'tips': tips[:6], 'source': 'ai_generated', 'hours_needed': total_needed, 'hours_scheduled': total_scheduled })
                    except Exception:
                        pass
            except Exception:
                pass

        print(f"Generating schedule for {len(subj_list)} subjects with {len(cell_states)} cell states")
        
        # Always use smart algorithm that respects availability
        # Kırmızıyı asla kullanma; kapasite yetmezse uyarı döndür
        def _capacity(slots_map):
            # count distinct slot keys
            return len({ f"{d}-{h}" for pr in ['green','yellow'] for (d,h) in slots_map.get(pr, []) })

        tentative_slots = self._get_available_slots(cell_states, day_states, available_days, list(range(8,22)))
        needed_hours = sum(h for _, h in subj_list)
        # remove red unconditionally
        tentative_slots['red'] = []
        # monkey-patch available_slots provider inside generator via wrapper
        original_get = self._get_available_slots
        def _patched_get(cell_states_p, day_states_p, available_days_p, all_hours_p):
            return tentative_slots
        self._get_available_slots = _patched_get  # type: ignore[assignment]

        smart_schedule = self._generate_smart_schedule_with_availability(
            subj_list, available_days, cell_states, day_states, weak_topics, strong_topics, preferences
        )
        # restore
        self._get_available_slots = original_get  # type: ignore[assignment]
        
        # Validate that all hours are scheduled
        total_hours_needed = sum(hours for _, hours in subj_list)
        total_hours_scheduled = sum(len(day['items']) for day in smart_schedule)
        
        print(f"Total hours needed: {total_hours_needed}, scheduled: {total_hours_scheduled}")
        
        # If we couldn't schedule all hours, try to force schedule the remaining
        if total_hours_scheduled < total_hours_needed:
            print(f"Warning: Only scheduled {total_hours_scheduled}/{total_hours_needed} hours. Trying to force schedule remaining hours.")
            # Add a warning tip to inform the user
            fallback_tips = [
                f"Uyarı: Sadece {total_hours_scheduled}/{total_hours_needed} saat planlanabildi. Daha fazla müsait saat eklemeyi deneyin.",
                "Yeşil saatlerde daha verimli çalışırsınız",
                "2'şerli ders blokları odaklanmanızı artırır", 
                "Her 3-4 saatte bir 15-30 dakika mola verin",
                "Zayıf konularınıza yeşil saatlerde odaklanın",
                "Düzenli tekrarlar bilgiyi kalıcı hale getirir"
            ]
            # Do NOT use red unless strictly required; attempt to place remaining only in yellow if green is exhausted
        else:
            fallback_tips = [
                "Yeşil saatlerde daha verimli çalışırsınız",
                "2'şerli ders blokları odaklanmanızı artırır", 
                "Her 3-4 saatte bir 15-30 dakika mola verin",
                "Zayıf konularınıza yeşil saatlerde odaklanın",
                "Düzenli tekrarlar bilgiyi kalıcı hale getirir"
            ]
        
        if weak_topics:
            fallback_tips.insert(0, f"{', '.join(weak_topics[:2])} konularına daha fazla zaman ayırın")
        
        return Response({ 
            'schedule': smart_schedule,
            'tips': fallback_tips[:6],
            'source': 'smart_algorithm_generated',
            'hours_needed': total_hours_needed,
            'hours_scheduled': total_hours_scheduled
        })

    def _generate_smart_schedule_with_availability(self, subj_list, available_days, cell_states, day_states, weak_topics, strong_topics, preferences):
        """
        Generate a complete schedule respecting user availability
        """
        base_schedule = [
            { 'day': 'Pzt', 'items': [] },
            { 'day': 'Sal', 'items': [] },
            { 'day': 'Çar', 'items': [] },
            { 'day': 'Per', 'items': [] },
            { 'day': 'Cum', 'items': [] },
            { 'day': 'Cmt', 'items': [] },
            { 'day': 'Paz', 'items': [] },
        ]
        
        all_hours = list(range(8, 22))  # 08:00 to 21:00
        
        # Get available slots based on user's cell states
        available_slots = self._get_available_slots(cell_states, day_states, available_days, all_hours)
        
        print(f"Available slots: {len(available_slots)}")
        for priority, slots in available_slots.items():
            print(f"  {priority}: {len(slots)} slots")
        
        # Calculate total hours needed
        total_hours_needed = sum(hours for _, hours in subj_list)
        print(f"Total hours needed: {total_hours_needed}")
        
        # Sort subjects by priority (weak topics first)
        def get_priority(name: str) -> int:
            if weak_topics and any(weak.lower() in name.lower() for weak in weak_topics):
                return 1
            return 2
        
        subj_list.sort(key=lambda x: (get_priority(x[0]), -x[1]))
        
        # Track used slots to avoid conflicts
        used_slots = set()
        
        # Place all subjects in order of priority
        for subject_tuple in subj_list:
            subject_name, total_hours = subject_tuple
            remaining_hours = total_hours
            print(f"\nScheduling {subject_name}: {total_hours} hours (Priority: {get_priority(subject_name)})")
            
            # For subjects with 2+ hours, create 2-hour blocks
            if total_hours >= 2:
                if total_hours % 2 == 0:
                    # Even hours: create all 2-hour blocks
                    while remaining_hours >= 2:
                        before_placement = remaining_hours
                        remaining_hours = self._place_consecutive_hours(
                            base_schedule, subject_name, remaining_hours, available_slots, used_slots, 2
                        )
                        # If no progress, break to avoid infinite loop
                        if remaining_hours == before_placement:
                            break
                else:
                    # Odd hours: create 2-hour blocks + 1 single hour
                    target_blocks = (total_hours - 1) // 2
                    blocks_to_place = target_blocks * 2
                    
                    # Place 2-hour blocks first
                    while remaining_hours > 1 and blocks_to_place > 0:
                        before_placement = remaining_hours
                        remaining_hours = self._place_consecutive_hours(
                            base_schedule, subject_name, min(2, remaining_hours), available_slots, used_slots, 2
                        )
                        if remaining_hours == before_placement:
                            break
                        blocks_to_place -= 2
        
            # Place remaining single hours
            if remaining_hours > 0:
                before_placement = remaining_hours
                remaining_hours = self._place_single_hours(
                    base_schedule, subject_name, remaining_hours, available_slots, used_slots
                )
                # If still can't place, try allowing same day placement
                if remaining_hours == before_placement and remaining_hours > 0:
                    remaining_hours = self._force_place_remaining_hours(
                        base_schedule, subject_name, remaining_hours, available_slots, used_slots
                    )
            
            if remaining_hours > 0:
                print(f"  WARNING: Could not schedule {remaining_hours} hours for {subject_name}")
        
        # Add some breaks if requested
        self._add_study_breaks(base_schedule, used_slots)
        
        # Final validation - try to place any remaining hours with a more aggressive approach
        for subject_tuple in subj_list:
            subject_name, total_hours = subject_tuple
            # Count how many hours were actually scheduled for this subject
            scheduled_hours = 0
            for day_schedule in base_schedule:
                for item in day_schedule['items']:
                    if subject_name in item and '-' in item and ':' in item:
                        scheduled_hours += 1
            
            remaining_hours = total_hours - scheduled_hours
            if remaining_hours > 0:
                print(f"Final attempt to schedule remaining {remaining_hours} hours for {subject_name}")
                # Try one last aggressive placement
                remaining_hours = self._force_place_remaining_hours(
                    base_schedule, subject_name, remaining_hours, available_slots, used_slots
                )
        
        return base_schedule
    
    def _get_available_slots(self, cell_states, day_states, available_days, all_hours):
        """
        Get available time slots organized by priority
        """
        slots = {
            'green': [],    # Most preferred
            'yellow': [],   # Moderately preferred
            'red': []       # Least preferred (only if desperate)
        }
        
        for day in available_days:
            for hour in all_hours:
                slot_key = f"{day}-{hour}"
                
                # Check specific cell state first
                if slot_key in cell_states:
                    state = cell_states[slot_key]
                # Fall back to day state
                elif day in day_states:
                    state = day_states[day]
                # Default availability for work hours
                elif 9 <= hour <= 17:  # Work hours
                    if hour in [9, 10, 14, 15]:  # Prime study hours
                        state = 'green'
                    elif hour in [11, 12, 16, 17]:  # Good study hours
                        state = 'yellow'
                    else:
                        state = 'yellow'
                else:
                    state = 'red'  # Early morning/late evening
                
                slots[state].append((day, hour))
        
        return slots
    
    def _place_consecutive_hours(self, schedule, subject_name, remaining_hours, available_slots, used_slots, block_size=2):
        """
        Try to place consecutive hour blocks (e.g., 2-hour sessions)
        Only move to next priority when current priority is exhausted
        """
        def has_free_block(slots_list, size):
            # any consecutive unused block exists in these slots?
            by_day = {}
            for d, h in slots_list:
                by_day.setdefault(d, []).append(h)
            for d, hours in by_day.items():
                hours.sort()
                for i in range(len(hours) - size + 1):
                    block = [(d, hh) for hh in hours[i:i+size]]
                    if all(block[j][1] + 1 == block[j+1][1] for j in range(len(block)-1)) and not any(f"{dd}-{hh}" in used_slots for dd, hh in block):
                        return True
            return False

        for priority in ['green', 'yellow', 'red']:
            if remaining_hours < block_size:
                break
                
            slots = available_slots[priority]
            blocks_placed = 0
            
            for day in ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']:
                if remaining_hours < block_size:
                    break
                    
                day_slots = [(d, h) for d, h in slots if d == day]
                day_slots.sort(key=lambda x: x[1])  # Sort by hour
                
                # Check if this day already has this subject (avoid consecutive same subject)
                day_schedule = next(d for d in schedule if d['day'] == day)
                has_same_subject = any(subject_name in item for item in day_schedule['items'])
                
                for i in range(len(day_slots) - block_size + 1):
                    # Check if we can create a consecutive block
                    block = day_slots[i:i + block_size]
                    hours = [h for _, h in block]
                    
                    # Check if hours are consecutive and not used
                    if (all(hours[j] + 1 == hours[j + 1] for j in range(len(hours) - 1)) and
                        not any(f"{d}-{h}" in used_slots for d, h in block)):
                        
                        # Avoid placing same subject on same day if possible
                        if has_same_subject and blocks_placed == 0:
                            continue
                            
                        # Place the block
                        start_hour = hours[0]
                        end_hour = hours[-1] + 1
                        session = f"{subject_name} {str(start_hour).zfill(2)}:00-{str(end_hour).zfill(2)}:00"
                        
                        day_schedule['items'].append(session)
                        
                        # Mark slots as used
                        for d, h in block:
                            used_slots.add(f"{d}-{h}")
                        
                        remaining_hours -= block_size
                        blocks_placed += 1
                        print(f"    Placed {block_size}h block: {session} [{priority}]")
                        break
            
            # Only move to next priority if we couldn't place any more blocks in current priority
            # Only proceed to next priority if there are truly no free blocks left in this priority
            if has_free_block(slots, block_size) and remaining_hours >= block_size:
                # Try again within the same priority to fully exhaust it
                return self._place_consecutive_hours(schedule, subject_name, remaining_hours, {priority: slots}, used_slots, block_size)
            # else continue to next priority
        
        return remaining_hours
    
    def _place_single_hours(self, schedule, subject_name, remaining_hours, available_slots, used_slots):
        """
        Place single hour sessions - don't move to next priority until current is exhausted
        """
        def has_free_slot(slots_list):
            return any(f"{d}-{h}" not in used_slots for d, h in slots_list)

        for priority in ['green', 'yellow', 'red']:
            if remaining_hours <= 0:
                break
                
            slots = available_slots[priority]
            hours_placed = 0
            
            for day, hour in slots:
                if remaining_hours <= 0:
                    break
                    
                slot_key = f"{day}-{hour}"
                if slot_key not in used_slots:
                    # Check if this day already has this subject (avoid consecutive same subject)
                    day_schedule = next(d for d in schedule if d['day'] == day)
                    has_same_subject = any(subject_name in item for item in day_schedule['items'])
                    
                    # Try to place on different day first if possible
                    if has_same_subject and hours_placed == 0:
                        continue
                        
                    session = f"{subject_name} {str(hour).zfill(2)}:00-{str(hour+1).zfill(2)}:00"
                    day_schedule['items'].append(session)
                    
                    used_slots.add(slot_key)
                    remaining_hours -= 1
                    hours_placed += 1
                    print(f"    Placed 1h session: {session} [{priority}]")
            
            # Only move to next priority if there are truly no free slots left in this priority
            if has_free_slot(slots) and remaining_hours > 0:
                # Try more in same priority until exhausted
                return self._place_single_hours(schedule, subject_name, remaining_hours, {priority: slots}, used_slots)
            # else continue to next priority
        
        return remaining_hours
    
    def _force_place_remaining_hours(self, schedule, subject_name, remaining_hours, available_slots, used_slots):
        """
        Force place remaining hours even if it means same subject on same day
        """
        for priority in ['green', 'yellow', 'red']:
            if remaining_hours <= 0:
                break
                
            slots = available_slots[priority]
            
            for day, hour in slots:
                if remaining_hours <= 0:
                    break
                    
                slot_key = f"{day}-{hour}"
                if slot_key not in used_slots:
                    session = f"{subject_name} {str(hour).zfill(2)}:00-{str(hour+1).zfill(2)}:00"
                    
                    day_schedule = next(d for d in schedule if d['day'] == day)
                    day_schedule['items'].append(session)
                    
                    used_slots.add(slot_key)
                    remaining_hours -= 1
                    print(f"    FORCED placement: {session} [{priority}]")
        
        return remaining_hours
    
    def _add_study_breaks(self, schedule, used_slots):
        """
        Add study breaks where appropriate
        """
        for day_schedule in schedule:
            items = day_schedule['items']
            if len(items) >= 3:  # Add breaks only if there are multiple sessions
                items.sort(key=lambda x: self._extract_start_time(x))
                
                # Add a break after every 3-4 hours of study
                study_hours = 0
                for i, item in enumerate(items[:]):
                    if study_hours >= 3 and '(Mola)' not in item:
                        break_time = self._get_break_time_for_item(item)
                        items.insert(i, f"🟡 Mola (15 dk) {break_time}")
                        study_hours = 0
                        break
                    
                    if '-' in item and ':' in item:
                        study_hours += 1
    
    def _extract_start_time(self, item):
        """
        Extract start time from schedule item
        """
        try:
            if ' ' in item and ':' in item:
                time_part = item.split(' ')[-1]  # Get last part which should be time
                if ':' in time_part and '-' in time_part:
                    start_time_str = time_part.split('-')[0]
                    return int(start_time_str.split(':')[0])
        except:
            pass
        return 0
    
    def _get_break_time_for_item(self, item):
        """
        Get break time for an item
        """
        try:
            start_hour = self._extract_start_time(item)
            break_hour = max(12, start_hour - 1)
            return f"{str(break_hour).zfill(2)}:30-{str(break_hour).zfill(2)}:45"
        except:
            return "12:30-12:45"


class AIQuizGenerateView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            topics = request.data.get('topics', '')
            try:
                num_questions = int(request.data.get('num_questions', 10))
            except (ValueError, TypeError):
                num_questions = 10
            difficulty = request.data.get('difficulty', 'orta')

            if not topics or not topics.strip():
                return Response({'error': 'Konu girilmesi gereklidir'}, status=status.HTTP_400_BAD_REQUEST)

            num_questions = min(max(num_questions, 1), 20)
            
            api_key = _get_ai_api_key()
            questions = []

            if api_key and topics:
                print(f"Starting AI generation with key: {api_key[:10]}...")
                for attempt in range(3):
                    try:
                        provider_url = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
                        headers = {
                            'Authorization': f'Bearer {api_key}',
                            'Content-Type': 'application/json',
                            'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                            'X-Title': os.getenv('OPENROUTER_TITLE', 'E-Teacher'),
                        }
                        
                        current_time = datetime.now().strftime('%Y%m%d%H%M%S')
                        random_seed = uuid.uuid4().hex[:12]
                        
                        topic_specific_prompt = self._create_topic_specific_prompt(topics, difficulty, num_questions, random_seed, current_time)
                        
                        payload = {
                            'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                            'messages': [ { 'role': 'user', 'content': topic_specific_prompt } ],
                            'response_format': { 'type': 'json_object' },
                            'temperature': 0.9,
                            'max_tokens': 1200,
                            'top_p': 0.95,
                            'frequency_penalty': 0.3,
                            'presence_penalty': 0.2,
                        }
                        
                        print(f"Attempt {attempt + 1}: Sending request to {provider_url}")
                        print(f"Model: {payload['model']}")
                        print(f"Headers: {list(headers.keys())}")
                        
                        # Multiple timeout attempts
                        timeout = 15 if attempt == 0 else 20  # Longer timeout on retries
                        resp = requests.post(provider_url, json=payload, headers=headers, timeout=timeout)
                        
                        print(f"Attempt {attempt + 1}: Response status {resp.status_code}")
                        
                        if resp.ok:
                            questions = self._parse_ai_response(resp.json(), num_questions)
                            if len(questions) >= num_questions:
                                print(f"AI generation successful on attempt {attempt + 1}: {len(questions)} questions")
                                break
                            else:
                                print(f"Attempt {attempt + 1}: Only got {len(questions)}/{num_questions} questions, retrying...")
                        else:
                            print(f"Attempt {attempt + 1}: API error {resp.status_code}: {resp.text[:200]}...")
                            
                    except Exception as e:
                        print(f"Attempt {attempt + 1}: AI generation failed: {e}")
                        if attempt < 2:  # Don't sleep on last attempt
                            import time
                            time.sleep(1)  # Brief pause before retry

            # SECONDARY: If AI failed completely, try different model or approach
            if not questions or len(questions) < num_questions:
                print(f"Primary AI failed. Trying secondary approach...")
                questions = self._try_secondary_ai_generation(topics, difficulty, num_questions, api_key)

            # TERTIARY: Last resort - generate emergency questions using AI with simpler prompt
            if not questions or len(questions) < num_questions:
                print(f"Secondary AI failed. Using emergency AI generation...")
                questions = self._emergency_ai_generation(topics, difficulty, num_questions, api_key)

            # NO FALLBACK: 100% AI-dependent as requested
            if not questions:
                print(f"All AI attempts failed. NO FALLBACK QUESTIONS as per user request.")
                # Check if the issue is missing API key
                if not api_key or api_key.startswith('sk-or-v1-your-api-key'):
                    return Response({
                        'error': f'AI API anahtarı yapılandırılmamış. Lütfen OpenRouter API anahtarınızı backend/openrouter.key dosyasına ekleyin.',
                        'questions': []
                    }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
                
                return Response({
                    'error': f'{topics} konusunda quiz oluşturulamadı. AI servisi şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin.',
                    'questions': []
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)

            # Only save to database if questions were successfully generated
            if questions and hasattr(request, 'user') and request.user.is_authenticated:
                try:
                    Assessment.objects.create(  # type: ignore[attr-defined]
                        user=request.user,
                        title='Quiz',
                        score=0,
                        data={ 'topics': topics, 'difficulty': difficulty, 'questions': questions }
                    )
                except Exception as e:
                    print(f"Failed to save assessment: {e}")
            
            return Response({ 'questions': questions })
            
        except Exception as e:
            topics = request.data.get('topics', 'Unknown')  # Ensure topics is defined
            print(f"Quiz generation error: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': f'{topics} konusunda quiz oluşturma sırasında hata oluştu: {str(e)}',
                'questions': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _create_topic_specific_prompt(self, topics, difficulty, num_questions, random_seed, current_time):
        """Create enhanced topic-specific prompts for better AI responses"""
        
        difficulty_instructions = {
            'kolay': 'Temel seviye sorular hazırla. Basit kavramlar, tanımlar ve direkt uygulamalar içersin.',
            'orta': 'Orta seviye sorular hazırla. Kavramları birbirleriyle ilişkilendiren, analiz gerektiren sorular içersin.',
            'zor': 'İleri seviye sorular hazırla. Sentez, değerlendirme ve karmaşık problem çözme gerektiren sorular içersin.'
        }
        
        difficulty_instruction = difficulty_instructions.get(difficulty, difficulty_instructions['orta'])
        
        # Enhanced topic-specific examples and styles
        topic_examples = {
            'matematik': {
                'style': 'Hesaplama, formül, grafik, geometri ve problem çözme',
                'example': 'f(x) = 3x² + 2x - 1 fonksiyonunun türevi nedir? A) 6x + 2  B) 3x + 2  C) 6x - 1  D) 3x² + 2. Doğru: 6x + 2',
                'topics': ['cebir', 'türev', 'integral', 'fonksiyonlar', 'geometri', 'trigonometri']
            },
            'fizik': {
                'style': 'Doğa kanunları, formüller, deneyler ve hesaplamalar',
                'example': 'Bir cisim 10 m/s hızla atılıyor. 2 saniye sonra hızı kaç m/s olur? (g=10m/s²) A) 20 m/s  B) 30 m/s  C) 25 m/s  D) 15 m/s. Doğru: 30 m/s',
                'topics': ['hareket', 'kuvvet', 'enerji', 'elektrik', 'magnetizma', 'optik']
            },
            'kimya': {
                'style': 'Moleküler yapılar, reaksiyonlar, hesaplamalar',
                'example': '2H₂ + O₂ → 2H₂O reaksiyonunda 4 mol H₂ kullanılırsa kaç mol H₂O oluşur? A) 2 mol  B) 4 mol  C) 6 mol  D) 8 mol. Doğru: 4 mol',
                'topics': ['asitler', 'bazlar', 'kimyasal bağlar', 'periyodik tablo', 'reaksiyonlar']
            },
            'biyoloji': {
                'style': 'Canlı sistemler, organlar, hücreler',
                'example': 'Fotosentez hangi organelde gerçekleşir? A) Mitokondri  B) Kloroplast  C) Ribozom  D) Çekirdek. Doğru: Kloroplast',
                'topics': ['hücre', 'genetik', 'ekoloji', 'fizyoloji', 'evrim']
            }
        }
        
        # Determine topic style and examples
        topic_info = None
        for key, info in topic_examples.items():
            if key.lower() in topics.lower():
                topic_info = info
                break
        
        if not topic_info:
            topic_info = {
                'style': 'Genel bilgi ve anlayış odaklı',
                'example': 'Genel bir akademik soru örneği',
                'topics': ['temel kavramlar']
            }
        
        return (
            f"TÜRKÇE OKUL SORULARI ÜRET: {topics} konusunda {difficulty} seviyesinde {num_questions} adet çoktan seçmeli okul sorusu üret.\n\n"
            f"ZORLUK SEVİYESİ: {difficulty_instruction}\n\n"
            f"KONU STİLİ: {topic_info['style']}\n\n"
            f"ALT KONULAR: {', '.join(topic_info['topics'])}\n\n"
            f"MUTLAKA UYULACAK KURALLAR:\n"
            f"1. SADECE gerçek okul müfredatı soruları üret\n"
            f"2. Meta sorular (öğrenme, başarı, strateji hakkında) KESINLIKLE YASAK\n"
            f"3. Her soru farklı alt konu içersin\n"
            f"4. Matematik: gerçek hesaplama, formül kullanımı\n"
            f"5. Fen: kanunlar, formüller, hesaplamalar\n"
            f"6. Tüm seçenekler mantıklı ve gerçekçi olmalı\n\n"
            f"ÖRNEK SORU FORMATI:\n{topic_info['example']}\n\n"
            f"ÇIKTI FORMATI - SADECE JSON:\n"
            f"{{\n"
            f'  "questions": [\n'
            f"    {{\n"
            f'      "q": "tam soru metni",\n'
            f'      "a": ["seçenek A", "seçenek B", "seçenek C", "seçenek D"],\n'
            f'      "correct": "doğru seçenek",\n'
            f'      "explanation": "detaylı açıklama"\n'
            f"    }}\n"
            f"  ]\n"
            f"}}\n\n"
            f"BENZERSİZLİK: {random_seed}-{current_time}\n"
            f"KESINLIKLE {num_questions} ADET GERÇEK AKADEMİK SORU ÜRET!"
        )
    
    def _parse_ai_response(self, response_json, num_questions):
        """Parse AI response and extract questions"""
        questions = []
        
        try:
            message = (response_json.get('choices') or [{}])[0].get('message', {})
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
                    # Try to extract JSON from response
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
                explanation = q.get('explanation', '')
                
                # Handle different correct answer formats
                if isinstance(correct, int):
                    try:
                        correct = opts[correct]
                    except (IndexError, TypeError):
                        correct = None
                
                # Validate question structure
                if (qtext and isinstance(opts, list) and len(opts) >= 2 and 
                    correct and correct in opts):
                    
                    question_data = {
                        'q': str(qtext).strip(),
                        'a': [str(opt).strip() for opt in opts[:4]],  # Ensure 4 options
                        'correct': str(correct).strip(),
                        'explanation': str(explanation).strip(),
                    }
                    
                    # Randomize answer positions
                    questions.append(randomize_quiz_options(question_data))
                    
                    if len(questions) >= num_questions:
                        break
        
        except Exception as e:
            print(f"Error parsing AI response: {e}")
        
        return questions
    
    def _try_secondary_ai_generation(self, topics, difficulty, num_questions, api_key):
        """Try secondary AI generation with different approach"""
        questions = []
        
        if not api_key:
            return questions
            
        try:
            provider_url = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                'X-Title': os.getenv('OPENROUTER_TITLE', 'E-Teacher'),
            }
            
            # Simpler, more direct prompt
            simple_prompt = (
                f"{topics} konusunda {difficulty} seviyesinde {num_questions} okul sorusu yaz. "
                f"Her soru 4 seçenekli olsun. JSON format: "
                f'{{"questions": [{{"q": "soru", "a": ["A", "B", "C", "D"], "correct": "doğru_cevap", "explanation": "açıklama"}}]}}'
            )
            
            payload = {
                'model': 'anthropic/claude-3.5-sonnet',  # Try different model
                'messages': [ { 'role': 'user', 'content': simple_prompt } ],
                'temperature': 0.7,
                'max_tokens': 1000,
            }
            
            resp = requests.post(provider_url, json=payload, headers=headers, timeout=15)
            if resp.ok:
                questions = self._parse_ai_response(resp.json(), num_questions)
                print(f"Secondary AI generated {len(questions)} questions")
        
        except Exception as e:
            print(f"Secondary AI generation failed: {e}")
        
        return questions
    
    def _emergency_ai_generation(self, topics, difficulty, num_questions, api_key):
        """Emergency AI generation with minimal prompt"""
        questions = []
        
        if not api_key:
            return questions
        
        try:
            provider_url = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                'X-Title': os.getenv('OPENROUTER_TITLE', 'E-Teacher'),
            }
            
            # Very simple emergency prompt
            emergency_prompt = f"{topics} konusu {num_questions} soru JSON format"
            
            payload = {
                'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                'messages': [ { 'role': 'user', 'content': emergency_prompt } ],
                'temperature': 0.5,
                'max_tokens': 800,
            }
            
            resp = requests.post(provider_url, json=payload, headers=headers, timeout=10)
            if resp.ok:
                questions = self._parse_ai_response(resp.json(), num_questions)
                print(f"Emergency AI generated {len(questions)} questions")
        
        except Exception as e:
            print(f"Emergency AI generation failed: {e}")
        
        return questions
    



class AIReportGenerateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        notes = request.data.get('notes', '')
        date = request.data.get('date', '')
        summary = f'Rapor özeti: {notes[:140]}'
        metrics = { 'math': 72, 'physics': 55, 'chemistry': 63 }
        assessment = Assessment.objects.create(user=request.user, title=f'Rapor {date or "bugün"}', score=0, data={ 'summary': summary, 'metrics': metrics })  # type: ignore[attr-defined]
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
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=12)
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

        Assessment.objects.create(  # type: ignore[attr-defined]
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
        message = ser.validated_data.get('message') or ''  # type: ignore[attr-defined]
        mood = ser.validated_data.get('mood') or ''  # type: ignore[attr-defined]
        history = ser.validated_data.get('history') or []  # type: ignore[attr-defined]
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
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=8)
                if resp.ok:
                    content = resp.json().get('choices', [{}])[0].get('message', {}).get('content') or ''
                    # log assessment
                    try:
                        Assessment.objects.create(user=request.user, title='PsychSupportChat', score=0, data={ 'mood': mood, 'message': message, 'reply': content })  # type: ignore[attr-defined]
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
            Assessment.objects.create(user=request.user, title='PsychSupportChat', score=0, data={ 'mood': mood, 'message': message, 'reply': fallback })  # type: ignore[attr-defined]
        except Exception:
            pass
        return Response({ 'support': fallback })


@method_decorator(csrf_exempt, name='dispatch')
class AIChatView(views.APIView):
    permission_classes = [permissions.AllowAny]

    class _Serializer(serializers.Serializer):
        message = serializers.CharField()
        history = serializers.ListField(child=serializers.DictField(), required=False)

    def post(self, request):
        ser = self._Serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        message = ser.validated_data['message']  # type: ignore[attr-defined]
        history = ser.validated_data.get('history') or []  # type: ignore[attr-defined]
        
        api_key = _get_ai_api_key()
        
        # For testing purposes, we'll allow chat to work even without API key
        # In production, you should require a valid API key
        if not api_key or api_key.startswith('sk-or-v1-your-api-key') or api_key.startswith('#'):
            # Return a mock response for testing
            return Response({ 
                'reply': f'(TEST) AI sohbet yanıtı: "{message}" için yardımcı olabilirim. Bu bir test yanıtıdır, gerçek AI entegrasyonu için geçerli bir API anahtarı gereklidir.' 
            })
        
        # Check if API key is configured properly
        if not api_key:
            return Response({ 
                'reply': 'AI sohbet özelliği henüz yapılandırılmamış. Lütfen yöneticiye OpenRouter API anahtarını backend/openrouter.key dosyasına eklenmesi gerektiğini bildirin.' 
            })
        
        if api_key and message:
            try:
                provider_url = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
                headers = {
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json',
                    'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                    'X-Title': os.getenv('OPENROUTER_TITLE', 'E-Teacher'),
                }
                
                # Build conversation history
                msgs = [{'role': 'system', 'content': 'Sen yardımcı bir öğretmensin. Türkçe, açık ve eğitici yanıtlar ver. Öğrencilere sabırla yardım et.'}]
                
                # Add recent conversation history
                for m in history[-12:]:
                    role = m.get('role') in ('user','assistant') and m.get('role') or 'user'
                    content = m.get('content') or ''
                    if content:
                        msgs.append({'role': role, 'content': content})
                
                # Add current message
                msgs.append({'role': 'user', 'content': message})
                
                payload = {
                    'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                    'messages': msgs,
                    'temperature': 0.7,  # Increased for more natural conversation
                    'max_tokens': 800,   # Increased for more detailed responses
                    'top_p': 0.9,
                }
                
                print(f"Sending chat request to: {provider_url}")
                print(f"Model: {payload['model']}")
                print(f"Message: {message[:50]}...")
                
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=15)
                
                print(f"API Response Status: {resp.status_code}")
                
                if resp.ok:
                    response_data = resp.json()
                    content = response_data.get('choices', [{}])[0].get('message', {}).get('content') or ''
                    
                    if content:
                        print(f"✅ Chat response received: {len(content)} characters")
                        return Response({ 'reply': content })
                    else:
                        print("❌ Empty response from AI")
                        return Response({ 'reply': 'AI den boş yanıt alındı. Lütfen tekrar deneyin.' })
                else:
                    error_text = resp.text
                    print(f"❌ API Error {resp.status_code}: {error_text[:200]}")
                    
                    if resp.status_code == 401:
                        return Response({ 'reply': 'API anahtarı geçersiz. Lütfen yöneticiye OpenRouter API anahtarının güncelleştirilmesi gerektiğini bildirin.' })
                    elif resp.status_code == 429:
                        return Response({ 'reply': 'API kullanım limitine ulaşıldı. Lütfen birkaç dakika sonra tekrar deneyin.' })
                    else:
                        return Response({ 'reply': f'AI servisi geçici olarak kullanılamıyor (Hata {resp.status_code}). Lütfen daha sonra tekrar deneyin.' })
                        
            except requests.exceptions.Timeout:
                print("❌ Request timeout")
                return Response({ 'reply': 'AI yanıt verme süresi aşıldı. Lütfen tekrar deneyin.' })
            except requests.exceptions.ConnectionError:
                print("❌ Connection error")
                return Response({ 'reply': 'AI servisine bağlanılamıyor. İnternet bağlantınızı kontrol edin.' })
            except Exception as e:
                print(f"❌ Chat error: {e}")
                import traceback
                traceback.print_exc()
                return Response({ 'reply': f'Sohbet sırasında beklenmeyen bir hata oluştu: {str(e)}' })
        
        # If no API key or message
        return Response({ 'reply': 'Mesaj gönderilemedi. Lütfen tekrar deneyin.' })


class AIChatSaveThreadView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    class _Serializer(serializers.Serializer):
        id = serializers.IntegerField(required=False)
        title = serializers.CharField(required=False, allow_blank=True)
        history = serializers.ListField(child=serializers.DictField())

    def post(self, request):
        ser = self._Serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        chat_id = ser.validated_data.get('id')  # type: ignore[attr-defined]
        title = ser.validated_data.get('title') or 'ChatThread'  # type: ignore[attr-defined]
        history = ser.validated_data['history']  # type: ignore[attr-defined]
        
        # Generate title from first message if not provided
        if title == 'ChatThread' and history:
            first_user_msg = None
            for msg in history:
                if msg.get('role') == 'user' and msg.get('content'):
                    first_user_msg = msg.get('content', '').strip()
                    break
            if first_user_msg:
                # Use first 30 chars of first user message as title
                title = f"Chat: {first_user_msg[:30]}..."
        
        # Update existing chat if id provided and belongs to user
        if chat_id:
            try:
                a = Assessment.objects.get(id=chat_id, user=request.user)  # type: ignore[attr-defined]
                a.title = title or a.title
                a.data = { **(a.data or {}), 'history': history, 'type': 'chat' }
                a.save(update_fields=['title', 'data'])
                return Response({ 'ok': True, 'id': a.id, 'created_at': a.created_at, 'title': a.title })
            except Assessment.DoesNotExist:  # type: ignore[attr-defined]
                pass

        # Otherwise create new
        a = Assessment.objects.create(user=request.user, title=title, score=0, data={ 'history': history, 'type': 'chat' })  # type: ignore[attr-defined]
        return Response({ 'ok': True, 'id': a.id, 'created_at': a.created_at, 'title': a.title })


@method_decorator(csrf_exempt, name='dispatch')
class AIChatHistoryView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """Get all chat histories for the user"""
        try:
            # Get all chat threads for the user
            chat_assessments = Assessment.objects.filter(  # type: ignore[attr-defined]
                user=request.user,
                data__type='chat'  # Filter for chat type
            ).order_by('-created_at')
            
            # If no chat type filter works, fall back to title-based filtering
            if not chat_assessments.exists():
                chat_assessments = Assessment.objects.filter(  # type: ignore[attr-defined]
                    user=request.user
                ).filter(
                    title__icontains='chat'
                ).order_by('-created_at')
            
            chats = []
            for assessment in chat_assessments[:50]:  # Limit to last 50 chats
                history = assessment.data.get('history', []) if assessment.data else []
                
                # Get preview (first user message)
                preview = "Empty chat"
                message_count = 0
                for msg in history:
                    if msg.get('role') == 'user' and msg.get('content'):
                        if preview == "Empty chat":
                            preview = msg.get('content', '')[:50] + "..." if len(msg.get('content', '')) > 50 else msg.get('content', '')
                    message_count += 1
                
                chat_data = {
                    'id': assessment.id,
                    'title': assessment.title,
                    'preview': preview,
                    'message_count': message_count,
                    'created_at': assessment.created_at.isoformat(),
                    'last_updated': assessment.created_at.isoformat()
                }
                chats.append(chat_data)
            
            return Response({
                'chats': chats,
                'total_count': len(chats)
            })
            
        except Exception as e:
            return Response({
                'error': f'Sohbet geçmişi alınırken hata oluştu: {str(e)}',
                'chats': []
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete(self, request):
        """Delete a specific chat by ID"""
        try:
            chat_id = request.data.get('chat_id') or request.GET.get('chat_id')
            if not chat_id:
                return Response({
                    'error': 'Chat ID gereklidir'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Find and delete the chat
            try:
                chat = Assessment.objects.get(  # type: ignore[attr-defined]
                    id=chat_id,
                    user=request.user
                )
                chat_title = chat.title
                chat.delete()
                
                return Response({
                    'ok': True,
                    'message': f'Sohbet "{chat_title}" başarıyla silindi',
                    'deleted_id': chat_id
                })
                
            except Assessment.DoesNotExist:  # type: ignore[attr-defined]
                return Response({
                    'error': 'Sohbet bulunamadı veya size ait değil'
                }, status=status.HTTP_404_NOT_FOUND)
                
        except Exception as e:
            return Response({
                'error': f'Sohbet silinirken hata oluştu: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class AIChatLoadView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, chat_id):
        """Load a specific chat history by ID"""
        try:
            # Find the chat
            chat = Assessment.objects.get(  # type: ignore[attr-defined]
                id=chat_id,
                user=request.user
            )
            
            history = chat.data.get('history', []) if chat.data else []
            
            return Response({
                'ok': True,
                'chat': {
                    'id': chat.id,
                    'title': chat.title,
                    'history': history,
                    'created_at': chat.created_at.isoformat(),
                    'message_count': len(history)
                }
            })
            
        except Assessment.DoesNotExist:  # type: ignore[attr-defined]
            return Response({
                'error': 'Sohbet bulunamadı veya size ait değil'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({
                'error': f'Sohbet yüklenirken hata oluştu: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class AIScheduleSaveView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        try:
            # Log the incoming data for debugging
            print("Saving schedule with data:", request.data)
            
            schedule_data = request.data.get('schedule', [])
            title = request.data.get('title', 'Ders Programı')
            
            # Validate required data
            if not schedule_data:
                return Response({
                    'error': 'Ders programı verisi boş olamaz'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # If user is not authenticated, don't attempt DB write; return success without saving
            if not hasattr(request, 'user') or not request.user.is_authenticated:
                return Response({
                    'ok': True,
                    'saved': False,
                    'message': 'Oturum açılmadı: Program yerel olarak oluşturuldu, kaydedilmedi.'
                }, status=status.HTTP_200_OK)
            # Single-record per user: update_or_create last schedule
            assessment, _ = Assessment.objects.update_or_create(  # type: ignore[attr-defined]
                user=request.user,
                title='CurrentSchedule',
                defaults={
                    'score': 0,
                    'data': {
                        'schedule': schedule_data,
                        'type': 'schedule',
                        'created_at': datetime.now().isoformat()
                    }
                }
            )
            return Response({
                'ok': True,
                'saved': True,
                'id': assessment.id,
                'message': 'Ders programı başarıyla kaydedildi'
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'error': f'Ders programı kaydedilirken hata oluştu: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def get(self, request):
        try:
            # If unauthenticated, return empty
            if not hasattr(request, 'user') or not request.user.is_authenticated:
                return Response({ 'schedule': None })
            latest = Assessment.objects.filter(  # type: ignore[attr-defined]
                user=request.user,
                data__type='schedule'
            ).order_by('-created_at').first()
            if not latest:
                return Response({ 'schedule': None })
            return Response({
                'schedule': {
                    'id': latest.id,
                    'title': latest.title,
                    'schedule': latest.data.get('schedule', []),
                    'created_at': latest.created_at.isoformat()
                }
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({
                'error': f'Ders programları alınırken hata oluştu: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class AIChatNewView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """Create a new chat session"""
        try:
            # Get optional title
            title = request.data.get('title', f'Yeni Sohbet - {datetime.now().strftime("%d.%m.%Y %H:%M")}')
            
            # For authenticated users, create a new chat record
            if hasattr(request, 'user') and request.user.is_authenticated:
                new_chat = Assessment.objects.create(  # type: ignore[attr-defined]
                    user=request.user,
                    title=title,
                    score=0,
                    data={'history': [], 'type': 'chat'}
                )
                
                return Response({
                    'ok': True,
                    'chat': {
                        'id': new_chat.id,
                        'title': new_chat.title,
                        'history': [],
                        'created_at': new_chat.created_at.isoformat()
                    }
                })
                
        except Exception as e:
            return Response({
                'error': f'Yeni sohbet oluşturulurken hata oluştu: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class AIDailyReportView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, date):
        """Get daily report for a specific date"""
        try:
            # Try to find existing report for this date
            report = Assessment.objects.filter(  # type: ignore[attr-defined]
                user=request.user,
                title=f'DailyReport {date}',
                data__type='daily_report'
            ).first()
            
            if report:
                return Response({
                    'sessions': report.data.get('sessions', []),
                    'aiAnalysis': report.data.get('aiAnalysis', '')
                })
            else:
                # Return empty report if none exists
                return Response({
                    'sessions': [],
                    'aiAnalysis': ''
                })
        except Exception as e:
            return Response({
                'error': f'Günlük rapor alınırken hata oluştu: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """Save daily report"""
        try:
            date = request.data.get('date')
            sessions = request.data.get('sessions', [])
            
            if not date:
                return Response({
                    'error': 'Tarih bilgisi gereklidir'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Create or update the report
            report, created = Assessment.objects.update_or_create(  # type: ignore[attr-defined]
                user=request.user,
                title=f'DailyReport {date}',
                defaults={
                    'score': 0,
                    'data': {
                        'type': 'daily_report',
                        'date': date,
                        'sessions': sessions,
                        'createdAt': datetime.now().isoformat()
                    }
                }
            )
            
            return Response({
                'ok': True,
                'message': 'Günlük çalışma raporu başarıyla kaydedildi'
            })
        except Exception as e:
            return Response({
                'error': f'Rapor kaydedilirken hata oluştu: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class AIDailyReportAnalyzeView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        """Analyze daily report with AI"""
        try:
            date = request.data.get('date')
            sessions = request.data.get('sessions', [])
            productivity_score = request.data.get('productivityScore')
            daily_notes = request.data.get('dailyNotes', '')

            if not date:
                return Response({ 'error': 'Tarih gereklidir' }, status=status.HTTP_400_BAD_REQUEST)

            # If no sessions provided, try infer from latest saved schedule for that weekday
            if not sessions:
                try:
                    from datetime import datetime as _dt
                    weekday = _dt.fromisoformat(date).weekday()  # 0=Mon..6=Sun
                    labels = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']
                    day_label = labels[weekday] if 0 <= weekday <= 6 else 'Pzt'
                    latest = Assessment.objects.filter(  # type: ignore[attr-defined]
                        user=request.user,
                        data__type='schedule'
                    ).order_by('-created_at').first()
                    if latest and latest.data:
                        sched = latest.data.get('schedule')
                        day_entry = None
                        if isinstance(sched, dict) and isinstance(sched.get('schedule'), list):
                            day_entry = next((d for d in sched['schedule'] if d.get('day') == day_label), None)
                        elif isinstance(sched, list):
                            day_entry = next((d for d in sched if d.get('day') == day_label), None)
                        if day_entry:
                            items = day_entry.get('items', [])
                            inferred = []
                            for it in items:
                                try:
                                    parts = it.rsplit(' ', 1)
                                    subject = parts[0].strip()
                                    times = parts[1]
                                    start, end = times.split('-')
                                    inferred.append({
                                        'id': uuid.uuid4().hex,
                                        'subject': subject,
                                        'startTime': start,
                                        'endTime': end,
                                        'productivity': int(productivity_score or 5),
                                        'notes': ''
                                    })
                                except Exception:
                                    continue
                            if inferred:
                                sessions = inferred
                except Exception:
                    pass

            if not sessions:
                return Response({ 'error': 'Analiz için oturum bulunamadı' }, status=status.HTTP_400_BAD_REQUEST)
            
            api_key = _get_ai_api_key()
            
            if not api_key:
                # Return mock analysis if no API key
                return Response({
                    'analysis': '(TEST) Günlük çalışma analiziniz: Çalışma süreniz oldukça verimli. Verimlilik puanınızın dengeli dağıldığını gözlemledim. Özellikle matematik dersindeki yüksek verimliliğiniz dikkat çekici. Daha fazla detay için gerçek bir AI entegrasyonu gereklidir.'
                })
            
            # Prepare data for AI analysis
            session_summary = []
            total_hours = 0
            productivity_scores = []
            
            for session in sessions:
                start_time = session.get('startTime', '00:00')
                end_time = session.get('endTime', '00:00')
                
                # Calculate duration
                try:
                    start_parts = start_time.split(':')
                    end_parts = end_time.split(':')
                    start_minutes = int(start_parts[0]) * 60 + int(start_parts[1])
                    end_minutes = int(end_parts[0]) * 60 + int(end_parts[1])
                    duration_minutes = end_minutes - start_minutes
                    duration_hours = duration_minutes / 60
                    total_hours += duration_hours
                except:
                    duration_hours = 0
                
                session_summary.append({
                    'subject': session.get('subject', 'Belirtilmemiş'),
                    'duration': round(duration_hours, 2),
                    'productivity': session.get('productivity', 5),
                    'notes': session.get('notes', '')
                })
                
                productivity_scores.append(session.get('productivity', 5))
            
            avg_productivity = sum(productivity_scores) / len(productivity_scores) if productivity_scores else 0
            
            # Create AI prompt with user productivity and notes
            prompt = (
                self._create_daily_report_prompt(date, session_summary, total_hours, avg_productivity)
                + f"\nGÜNLÜK VERİMLİLİK PUANI: {productivity_score or 'Belirtilmedi'}/10\n"
                + f"KULLANICI NOTLARI: {daily_notes or 'Yok'}\n"
                + "Yukarıdaki bilgilere dayanarak net, uygulanabilir ve kısa öneriler ver. Sadece metin döndür."
            )
            
            # Call AI API
            provider_url = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions')
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': os.getenv('OPENROUTER_SITE_URL', 'http://localhost:5173'),
                'X-Title': os.getenv('OPENROUTER_TITLE', 'E-Teacher'),
            }
            
            payload = {
                'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                'messages': [{'role': 'user', 'content': prompt}],
                'temperature': 0.5,
                'max_tokens': 1000,
            }
            
            resp = requests.post(provider_url, json=payload, headers=headers, timeout=15)
            
            if resp.ok:
                response_data = resp.json()
                content = response_data.get('choices', [{}])[0].get('message', {}).get('content') or ''
                
                # Save analysis to database
                Assessment.objects.create(  # type: ignore[attr-defined]
                    user=request.user,
                    title=f'DailyReportAnalysis {date}',
                    score=avg_productivity,
                    data={
                        'type': 'daily_report_analysis',
                        'date': date,
                        'sessions': sessions,
                        'analysis': content,
                        'totalHours': total_hours,
                        'avgProductivity': avg_productivity
                    }
                )
                
                return Response({'analysis': content})
            else:
                return Response({
                    'analysis': f'AI analizi yapılırken hata oluştu. Durum kodu: {resp.status_code}'
                })
                
        except Exception as e:
            return Response({
                'analysis': f'AI analizi yapılırken beklenmeyen hata oluştu: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _create_daily_report_prompt(self, date, session_summary, total_hours, avg_productivity):
        """Create a prompt for daily report analysis"""
        return (
            f"GÜNLÜK ÇALIŞMA RAPORU ANALİZİ\n\n"
            f"Tarih: {date}\n"
            f"Toplam Çalışma Süresi: {total_hours:.2f} saat\n"
            f"Ortalama Verimlilik: {avg_productivity:.1f}/10\n\n"
            f"Çalışma Oturumları:\n"
            + "\n".join([
                f"- {s['subject']}: {s['duration']:.2f} saat, Verimlilik: {s['productivity']}/10"
                for s in session_summary
            ])
            + "\n\n"
            f"GÖREV:\n"
            f"1. Öğrencinin günlük çalışma performansını değerlendir\n"
            f"2. Verimlilik puanlarına göre güçlü ve zayıf yönlerini analiz et\n"
            f"3. Zaman yönetimi açısından geri bildirim ver\n"
            f"4. Derslere göre verimlilik dağılımını yorumla\n"
            f"5. Geliştirilebilecek alanlar için öneriler sun\n"
            f"6. Motivasyonu artırmak için pozitif geri bildirimler ver\n\n"
            f"ÇIKTI FORMATI:\n"
            f"Öğrenci dostu, teşvik edici ve yapıcı bir dil kullan. "
            f"Analizini maddeler halinde sun. "
            f"Her maddede spesifik ve uygulanabilir öneriler ver."
        )


@method_decorator(csrf_exempt, name='dispatch')
class TargetNetsView(views.APIView):
    """
    Return estimated TYT/AYT target net ranges for a given university and department.
    This uses simple heuristics/mappings and can be later upgraded to pull real data.
    """
    permission_classes = [permissions.AllowAny]

    class _Serializer(serializers.Serializer):
        university = serializers.CharField()
        department = serializers.CharField()

    def post(self, request):
        ser = self._Serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        university = ser.validated_data['university']  # type: ignore[attr-defined]
        department = ser.validated_data['department']  # type: ignore[attr-defined]

        dep_lower = department.lower()

        # Very lightweight mapping by selectivity bands
        if any(k in dep_lower for k in ['tıp', 'medicine', 'hekim']):
            band = 'top_20k'
        elif any(k in dep_lower for k in ['hukuk', 'law']):
            band = 'top_50k'
        elif any(k in dep_lower for k in ['bilgisayar', 'computer', 'yazılım', 'software']):
            band = 'top_30k'
        elif any(k in dep_lower for k in ['psikoloji', 'psychology']):
            band = 'top_80k'
        elif any(k in dep_lower for k in ['mimarlık', 'architecture']):
            band = 'top_70k'
        elif any(k in dep_lower for k in ['endüstri', 'industrial']):
            band = 'top_60k'
        else:
            band = 'top_100k'

        band_to_targets = {
            'top_20k': {
                'tyt': '110-120',
                'ayt': '65-75',
                'subject_nets': { 'turkce': '35-40', 'matematik': '28-32', 'fen': '22-28', 'sosyal': '18-22' }
            },
            'top_30k': {
                'tyt': '100-110',
                'ayt': '55-65',
                'subject_nets': { 'turkce': '32-38', 'matematik': '24-30', 'fen': '18-24', 'sosyal': '16-20' }
            },
            'top_50k': {
                'tyt': '95-105',
                'ayt': '45-55',
                'subject_nets': { 'turkce': '30-36', 'matematik': '20-26', 'fen': '16-22', 'sosyal': '14-18' }
            },
            'top_60k': {
                'tyt': '90-100',
                'ayt': '40-50',
                'subject_nets': { 'turkce': '28-34', 'matematik': '18-24', 'fen': '14-20', 'sosyal': '12-16' }
            },
            'top_70k': {
                'tyt': '85-95',
                'ayt': '38-48',
                'subject_nets': { 'turkce': '26-32', 'matematik': '16-22', 'fen': '12-18', 'sosyal': '12-16' }
            },
            'top_80k': {
                'tyt': '82-92',
                'ayt': '35-45',
                'subject_nets': { 'turkce': '26-30', 'matematik': '14-20', 'fen': '12-16', 'sosyal': '12-16' }
            },
            'top_100k': {
                'tyt': '75-90',
                'ayt': '30-40',
                'subject_nets': { 'turkce': '24-30', 'matematik': '12-18', 'fen': '10-16', 'sosyal': '10-14' }
            }
        }

        # If AI key exists, ask AI to compute generalized targets using provided info
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
                import json
                prompt = (
                    "Üniversite ve bölüm hedefine göre TYT/AYT genel hedef net aralıklarını tahmin et. "
                    "Ör: TYT 70+ gibi yuvarlak, anlaşılır aralıklar ver. Derslere göre servis edebileceğin genel net dağılımı da döndür. SADECE JSON:")
                prompt += (
                    f"\nGirdi: üniversite='{university}', bölüm='{department}'. ÇIKTI ŞEMASI: "
                    "{\n  \"tyt_requirement\": \"ör: 70+\",\n  \"ayt_requirement\": \"ör: 40+\",\n  \"subject_nets\": { ders: \"ör: 20+\" }\n}"
                )
                payload = {
                    'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                    'messages': [ { 'role': 'user', 'content': prompt } ],
                    'response_format': { 'type': 'json_object' },
                    'temperature': 0.3,
                    'max_tokens': 600,
                }
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=12)
                if resp.ok:
                    data = resp.json().get('choices', [{}])[0].get('message', {}).get('content') or '{}'
                    try:
                        parsed = json.loads(data)
                        return Response({
                            'university': university,
                            'department': department,
                            'band': band,
                            'tyt_requirement': parsed.get('tyt_requirement') or band_to_targets.get(band, band_to_targets['top_100k'])['tyt'],
                            'ayt_requirement': parsed.get('ayt_requirement') or band_to_targets.get(band, band_to_targets['top_100k'])['ayt'],
                            'subject_nets': parsed.get('subject_nets') or band_to_targets.get(band, band_to_targets['top_100k'])['subject_nets']
                        })
                    except Exception:
                        pass
            except Exception:
                pass

        targets = band_to_targets.get(band, band_to_targets['top_100k'])
        return Response({
            'university': university,
            'department': department,
            'band': band,
            'tyt_requirement': targets['tyt'],
            'ayt_requirement': targets['ayt'],
            'subject_nets': targets['subject_nets']
        })


@method_decorator(csrf_exempt, name='dispatch')
class AIPerCourseAveragesView(views.APIView):
    """
    Return AI-personalized general net averages per course for the student.
    Falls back to simple averages based on last assessments if AI key is missing.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        api_key = _get_ai_api_key()

        # Try to derive simple per-course averages from recent assessments
        recent = Assessment.objects.filter(user=request.user).order_by('-created_at')[:10]  # type: ignore[attr-defined]
        aggregates: Dict[str, List[float]] = {}
        for a in recent:
            data = a.data or {}
            # Try known shapes
            if isinstance(data.get('result'), dict):
                pass
            # If an exam analysis stored subjects with net values
            subjects = data.get('subjects') or []
            if isinstance(subjects, list):
                for s in subjects:
                    try:
                        name = str(s.get('name') or s.get('subject') or '').strip()
                        net = float(s.get('net') or 0)
                    except Exception:
                        continue
                    if name:
                        aggregates.setdefault(name, []).append(net)

        simple_avg = {k: round(sum(v) / len(v), 2) for k, v in aggregates.items() if v}

        # If AI key exists, optionally refine with AI prompt using user's context
        if api_key and simple_avg:
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
                    "Öğrencinin geçmiş sınav verilerine göre her ders için genel net ortalamasını tahmin et ve SADECE JSON ver. "
                    "Şema: {\n  \"averages\": { ders: net }\n}. "
                    f"Girdi: {json.dumps(simple_avg, ensure_ascii=False)}"
                )
                payload = {
                    'model': os.getenv('OPENROUTER_MODEL', 'deepseek/deepseek-chat'),
                    'messages': [{ 'role': 'user', 'content': prompt }],
                    'response_format': { 'type': 'json_object' },
                    'temperature': 0.2,
                    'max_tokens': 600,
                }
                resp = requests.post(provider_url, json=payload, headers=headers, timeout=10)
                if resp.ok:
                    data = resp.json().get('choices', [{}])[0].get('message', {}).get('content') or '{}'
                    try:
                        import json as _json
                        parsed = _json.loads(data)
                        ai_avg = parsed.get('averages') or {}
                        if isinstance(ai_avg, dict) and ai_avg:
                            # store as assessment log
                            try:
                                Assessment.objects.create(user=request.user, title='PerCourseAverages', score=0, data={'type': 'ai_avg', 'averages': ai_avg})  # type: ignore[attr-defined]
                            except Exception:
                                pass
                            return Response({ 'averages': ai_avg })
                    except Exception:
                        pass
            except Exception:
                pass

        # Fallback to simple averages or defaults
        if simple_avg:
            return Response({ 'averages': simple_avg })
        return Response({ 'averages': { 'Türkçe': 25.0, 'Matematik': 18.0, 'Fen': 14.0, 'Sosyal': 12.0 } })