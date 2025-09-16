from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    full_name = models.CharField(max_length=150, blank=True)
    bio = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.full_name or self.user.username

# Create your models here.


class CareerRoadmap(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='career_roadmaps')
    interests = models.TextField(blank=True)
    strengths = models.TextField(blank=True)
    goals = models.TextField(blank=True)
    recommendations = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"CareerRoadmap({self.user.username}, {self.created_at:%Y-%m-%d})"