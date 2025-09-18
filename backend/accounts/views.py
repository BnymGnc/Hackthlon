from rest_framework import permissions, status, generics, views
from rest_framework.response import Response
from rest_framework.serializers import ModelSerializer, CharField, EmailField, ListField, ValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from django.contrib.auth.models import User
from .models import UserProfile, CareerRoadmap
import os
import requests
from typing import TYPE_CHECKING, Any, Dict

if TYPE_CHECKING:
    from django.db import models


class RegisterSerializer(ModelSerializer):
    email = EmailField(required=True)
    password = CharField(write_only=True)

    class Meta:
        model = User
        fields = ["username", "email", "password"]

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )
        UserProfile.objects.create(user=user)  # type: ignore[attr-defined]
        return user

    def validate(self, attrs):
        username = attrs.get("username")
        email = attrs.get("email")
        if User.objects.filter(username=username).exists():
            raise ValidationError({"username": "Bu kullanıcı adı zaten kullanımda"})
        if User.objects.filter(email=email).exists():
            raise ValidationError({"email": "Bu e-posta ile kayıt zaten var"})
        return attrs


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class ProfileSerializer(ModelSerializer):
    username = CharField(source="user.username", read_only=True)
    email = EmailField(source="user.email", read_only=True)

    class Meta:
        model = UserProfile
        fields = ["username", "email", "full_name", "bio", "created_at"]


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        profile, _ = UserProfile.objects.get_or_create(user=self.request.user)  # type: ignore[attr-defined]
        return profile

# Create your views here.


class CareerRoadmapSerializer(ModelSerializer):
    class Meta:
        model = CareerRoadmap
        fields = ["id", "interests", "strengths", "goals", "recommendations", "created_at"]


class SaveCareerRoadmapView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        interests = request.data.get('interests', '')
        strengths = request.data.get('strengths', '')
        goals = request.data.get('goals', '')

        # Try to call internal AI recommend endpoint
        recs = []
        try:
            base = os.getenv('EXTERNAL_BASE_URL') or 'http://127.0.0.1:8000'
            headers = { 'Authorization': request.headers.get('Authorization', '') }
            prompt = f"İlgi alanları: {interests}\nGüçlü yönler: {strengths}\nHedefler: {goals}\nÖğrenci için 5 kısa kariyer önerisi ver."
            resp = requests.post(f"{base}/api/ai/recommend/", json={ 'prompt': prompt }, headers=headers, timeout=10)
            if resp.ok:
                txt = resp.json().get('result', '')
                # naive split lines into recommendations
                for line in txt.splitlines():
                    line = line.strip('- ').strip()
                    if line:
                        recs.append(line)
                recs = recs[:5] if recs else []
        except Exception:
            pass

        if not recs:
            recs = [
                "Yazılım Mühendisliği",
                "Veri Bilimi",
                "Endüstri Mühendisliği",
                "Psikoloji",
            ]

        roadmap = CareerRoadmap.objects.create(  # type: ignore[attr-defined]
            user=request.user,
            interests=interests,
            strengths=strengths,
            goals=goals,
            recommendations=recs,
        )
        serializer = CareerRoadmapSerializer(roadmap)
        return Response({"ok": True, "recommendations": recs, "roadmap": serializer.data})


class CareerRoadmapListView(generics.ListAPIView):
    serializer_class = CareerRoadmapSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CareerRoadmap.objects.filter(user=self.request.user).order_by('-created_at')  # type: ignore[attr-defined]


class EmailOrUsernameTokenSerializer(TokenObtainPairSerializer):
    username_field = User.USERNAME_FIELD

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        # If username looks like email, map to actual username
        if username and '@' in username:
            try:
                user = User.objects.get(email__iexact=username)
                attrs['username'] = getattr(user, self.username_field)
            except User.DoesNotExist:  # type: ignore[attr-defined]
                pass
        return super().validate(attrs)


class EmailOrUsernameTokenObtainPairView(TokenObtainPairView):
    serializer_class = EmailOrUsernameTokenSerializer
    permission_classes = [permissions.AllowAny]
