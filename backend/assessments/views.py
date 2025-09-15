from rest_framework import permissions, viewsets
from rest_framework.serializers import ModelSerializer
from .models import Assessment


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
