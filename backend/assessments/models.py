from django.db import models
from django.contrib.auth.models import User


class Assessment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assessments', db_index=True)
    title = models.CharField(max_length=200, db_index=True)
    score = models.FloatField(default=0.0, db_index=True)  # type: ignore[arg-type]
    data = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['user', 'title']),
            models.Index(fields=['title', 'created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self) -> str:
        return f"Assessment({self.user.username}, {self.title})"  # type: ignore[attr-defined]

# Create your models here.
