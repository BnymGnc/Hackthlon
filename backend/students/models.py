from django.db import models
from django.contrib.auth.models import User


class Student(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student')
    grade_level = models.CharField(max_length=50, blank=True)
    interests = models.TextField(blank=True)
    exam_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Student({self.user.username})"

# Create your models here.
