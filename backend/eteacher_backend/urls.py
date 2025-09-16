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
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)
from students.views import StudentViewSet
from assessments.views import AssessmentViewSet
from accounts.views import RegisterView, ProfileView, SaveCareerRoadmapView, CareerRoadmapListView
from ai.views import AIRecommendView, AISummarizeView, AIStudyScheduleView, AIQuizGenerateView, AIReportGenerateView, AIExamAnalysisView

router = DefaultRouter()
router.register(r'students', StudentViewSet, basename='student')
router.register(r'assessments', AssessmentViewSet, basename='assessment')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/register/', RegisterView.as_view(), name='auth_register'),
    path('api/me/profile/', ProfileView.as_view(), name='me_profile'),
    path('api/me/roadmaps/', CareerRoadmapListView.as_view(), name='me_roadmaps'),
    path('api/profiles/save_career_roadmap/', SaveCareerRoadmapView.as_view(), name='save_career_roadmap'),
    path('api/', include(router.urls)),
    path('api/ai/recommend/', AIRecommendView.as_view(), name='ai_recommend'),
    path('api/ai/summarize/', AISummarizeView.as_view(), name='ai_summarize'),
    path('api/ai/schedule/', AIStudyScheduleView.as_view(), name='ai_schedule'),
    path('api/ai/quiz/', AIQuizGenerateView.as_view(), name='ai_quiz'),
    path('api/ai/report/', AIReportGenerateView.as_view(), name='ai_report'),
    path('api/ai/exam-analysis/', AIExamAnalysisView.as_view(), name='ai_exam_analysis'),
]
