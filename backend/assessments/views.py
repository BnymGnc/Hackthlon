from rest_framework import permissions, viewsets, views, status
from rest_framework.response import Response
from rest_framework.serializers import ModelSerializer
from .models import Assessment
from django.db.models import Avg


class AssessmentSerializer(ModelSerializer):
    class Meta:
        model = Assessment
        fields = ["id", "title", "score", "data", "created_at"]


class AssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = AssessmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Assessment.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

# Create your views here.


class QuizStatsView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = Assessment.objects.filter(user=request.user)
        # Average over saved quiz results; fallback to any Assessment titled like Quiz
        quiz_results = qs.filter(title__icontains='QuizResult')
        if not quiz_results.exists():
            quiz_results = qs.filter(title__icontains='Quiz')
        avg_score = quiz_results.aggregate(avg=Avg('score')).get('avg') or 0

        # Per-topic accuracy if available in data
        from collections import defaultdict
        topic_correct = defaultdict(int)
        topic_total = defaultdict(int)
        for a in quiz_results:
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
            Assessment.objects.create(
                user=request.user,
                title='QuizResult',
                score=score,
                data={ 'topics': topics, 'questions': questions, 'selected': selected }
            )
            return Response({ 'ok': True }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({ 'ok': False, 'error': str(e) }, status=status.HTTP_400_BAD_REQUEST)
