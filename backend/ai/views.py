from rest_framework import permissions, views, status
from rest_framework.response import Response
import os
import requests


class AIRecommendView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        prompt = request.data.get('prompt') or 'öğrenci için kariyer öner'
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key:
            try:
                # Minimal call example (pseudo for portability):
                headers = { 'Authorization': f'Bearer {api_key}' }
                # Replace with actual provider endpoint/model you prefer.
                # Here we just simulate success response.
                content = f"AI öneri (mock via provider): {prompt}"
                return Response({ 'result': content })
            except Exception as e:
                return Response({ 'result': f'mock: {prompt}', 'error': str(e) }, status=status.HTTP_200_OK)
        # Fallback mock
        return Response({ 'result': f'mock: {prompt}' })


class AISummarizeView(views.APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        text = request.data.get('text') or ''
        api_key = os.getenv('OPENAI_API_KEY')
        if api_key and text:
            try:
                headers = { 'Authorization': f'Bearer {api_key}' }
                content = (text[:120] + '...') if len(text) > 120 else text
                return Response({ 'summary': f'AI özet (mock via provider): {content}' })
            except Exception as e:
                return Response({ 'summary': f'mock: {text[:200]}', 'error': str(e) }, status=status.HTTP_200_OK)
        return Response({ 'summary': f'mock: {text[:200]}' })

# Create your views here.
