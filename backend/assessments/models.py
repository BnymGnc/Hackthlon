from django.db import models
from django.contrib.auth.models import User


class Assessment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assessments')
    title = models.CharField(max_length=200)
    score = models.FloatField(default=0)
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Assessment({self.user.username}, {self.title})"

# Create your models here.
