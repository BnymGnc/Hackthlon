from rest_framework import permissions, viewsets, views, status
from rest_framework.response import Response
from rest_framework.serializers import ModelSerializer
from .models import Assessment
from django.db.models import Avg
from datetime import datetime, timedelta


class AssessmentSerializer(ModelSerializer):
    class Meta:
        model = Assessment
        fields = ["id", "title", "score", "data", "created_at"]


class AssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssessmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Optimize query with select_related and prefetch_related if needed
        return Assessment.objects.filter(user=self.request.user).order_by('-created_at')  # type: ignore[attr-defined]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

# Create your views here.


class QuizStatsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Optimize query with better filtering and limit results
        qs = Assessment.objects.filter(user=request.user).order_by('-created_at')[:100]  # Limit to last 100  # type: ignore[attr-defined]
        
        # Average over saved quiz results; fallback to any Assessment titled like Quiz
        quiz_results = [a for a in qs if 'QuizResult' in a.title]
        if not quiz_results:
            quiz_results = [a for a in qs if 'Quiz' in a.title]
        
        # Calculate average score more efficiently
        scores = [a.score for a in quiz_results if a.score]
        avg_score = sum(scores) / len(scores) if scores else 0

        # Per-topic accuracy if available in data
        from collections import defaultdict
        topic_correct = defaultdict(int)
        topic_total = defaultdict(int)
        
        # Limit processing to most recent quiz results for performance
        for a in quiz_results[:20]:  # Process only last 20 quiz results
            data = a.data or {}
            per_q = data.get('questions') or []
            selected = data.get('selected') or {}
            topic = (data.get('topics') or '').strip() or 'Genel'
            if per_q and isinstance(per_q, list):
                for idx, q in enumerate(per_q):
                    key = str(idx)
                    user_choice = selected.get(key)
                    correct = q.get('correct')
                    topic_total[topic] += 1
                    if user_choice == correct:
                        topic_correct[topic] += 1
                        
        topic_stats = []
        for t in topic_total.keys():
            total = topic_total[t]
            corr = topic_correct[t]
            pct = round((corr / max(total, 1)) * 100, 2)
            topic_stats.append({ 'topic': t, 'accuracy': pct, 'total': total })

        return Response({ 'average': round(avg_score or 0, 2), 'topics': topic_stats })


class SaveQuizResultView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            payload = request.data or {}
            topics = payload.get('topics') or ''
            questions = payload.get('questions') or []
            selected = payload.get('selected') or {}
            score = float(payload.get('score') or 0)
            Assessment.objects.create(  # type: ignore[attr-defined]
                user=request.user,
                title='QuizResult',
                score=score,
                data={ 'topics': topics, 'questions': questions, 'selected': selected }
            )
            return Response({ 'ok': True }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({ 'ok': False, 'error': str(e) }, status=status.HTTP_400_BAD_REQUEST)


class PastEventsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get user's past events/assessments with proper formatting for calendar view"""
        try:
            # Get filter parameters
            days_back = int(request.GET.get('days', 30))  # Default last 30 days
            event_type = request.GET.get('type', 'all')  # all, quiz, schedule, report
            
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)
            
            # Query assessments within date range
            qs = Assessment.objects.filter(  # type: ignore[attr-defined]
                user=request.user,
                created_at__gte=start_date,
                created_at__lte=end_date
            ).order_by('-created_at')
            
            # Filter by type if specified
            if event_type != 'all':
                type_filters = {
                    'quiz': ['Quiz', 'QuizResult'],
                    'schedule': ['Schedule', 'StudyPlan'],
                    'report': ['Rapor', 'Report', 'ExamAnalysis']
                }
                if event_type in type_filters:
                    title_contains = type_filters[event_type]
                    qs = qs.filter(title__in=title_contains)
            
            # Format events for frontend
            events = []
            for assessment in qs[:50]:  # Limit to 50 most recent
                event_data = {
                    'id': assessment.id,
                    'title': assessment.title,
                    'date': assessment.created_at.strftime('%Y-%m-%d'),
                    'time': assessment.created_at.strftime('%H:%M'),
                    'score': assessment.score,
                    'type': self._get_event_type(assessment.title),
                    'details': self._format_event_details(assessment)
                }
                events.append(event_data)
            
            # Group events by date for calendar view
            events_by_date = {}
            for event in events:
                date = event['date']
                if date not in events_by_date:
                    events_by_date[date] = []
                events_by_date[date].append(event)
            
            return Response({
                'events': events,
                'events_by_date': events_by_date,
                'total_count': len(events),
                'date_range': {
                    'start': start_date.strftime('%Y-%m-%d'),
                    'end': end_date.strftime('%Y-%m-%d')
                }
            })
            
        except Exception as e:
            return Response({
                'error': f'Geçmiş etkinlikler alınırken hata oluştu: {str(e)}',
                'events': [],
                'events_by_date': {}
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def _get_event_type(self, title):
        """Determine event type from title"""
        title_lower = title.lower()
        if 'quiz' in title_lower:
            return 'quiz'
        elif any(word in title_lower for word in ['rapor', 'report', 'exam', 'analiz']):
            return 'report'
        elif any(word in title_lower for word in ['schedule', 'plan']):
            return 'schedule'
        else:
            return 'other'
    
    def _format_event_details(self, assessment):
        """Format event details based on type"""
        data = assessment.data or {}
        event_type = self._get_event_type(assessment.title)
        
        if event_type == 'quiz':
            questions_count = len(data.get('questions', []))
            topics = data.get('topics', 'Genel')
            return {
                'topics': topics,
                'questions_count': questions_count,
                'score_percentage': f"{assessment.score}%" if assessment.score else '0%'
            }
        elif event_type == 'report':
            summary = data.get('summary', '')[:100] + '...' if len(data.get('summary', '')) > 100 else data.get('summary', '')
            return {
                'summary': summary,
                'metrics': data.get('metrics', {})
            }
        elif event_type == 'schedule':
            return {
                'description': 'Ders programı oluşturuldu',
                'items_count': len(data.get('schedule', []))
            }
        else:
            return {
                'description': 'Genel etkinlik'
            }
