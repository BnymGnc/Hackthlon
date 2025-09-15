from rest_framework import permissions, status, generics
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import UserProfile
from rest_framework.serializers import ModelSerializer, CharField, EmailField


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
        UserProfile.objects.create(user=user)
        return user


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
        profile, _ = UserProfile.objects.get_or_create(user=self.request.user)
        return profile

# Create your views here.
