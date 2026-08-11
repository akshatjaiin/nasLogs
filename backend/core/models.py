import secrets
from django.db import models

class Organization(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name
    
class Project(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=255)
    opencost_url = models.URLField(help_text='Base URL of the OpenCost API')
    k8s_context = models.CharField(max_length=255, blank=True, default='')
    api_key = models.CharField(max_length=64, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['api_key']),
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.api_key:
            self.api_key = secrets.token_hex(32)
        super().save(*args, **kwargs)
    
class Cluster(models.Model):
    class Provider(models.TextChoices):
        AWS = 'aws', 'Amazon Web Services'
        GCP = 'gcp', 'Google Cloud Platform'
        AZURE = 'azure', 'Microsoft Azure'
        
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='clusters')
    provider = models.CharField(max_length=10, choices=Provider.choices, default=Provider.AWS)
    region = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        indexes = [
            models.Index(fields=['project', 'name']),
        ]

    def __str__(self):
        return f"{self.name} ({self.provider})"
