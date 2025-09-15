"""
URL configuration for eteacher_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from students.views import StudentViewSet
from assessments.views import AssessmentViewSet
from accounts.views import RegisterView, ProfileView
from ai.views import AIRecommendView, AISummarizeView

router = DefaultRouter()
router.register(r'students', StudentViewSet, basename='student')
router.register(r'assessments', AssessmentViewSet, basename='assessment')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/register/', RegisterView.as_view(), name='auth_register'),
    path('api/me/profile/', ProfileView.as_view(), name='me_profile'),
    path('api/', include(router.urls)),
    path('api/ai/recommend/', AIRecommendView.as_view(), name='ai_recommend'),
    path('api/ai/summarize/', AISummarizeView.as_view(), name='ai_summarize'),
]
