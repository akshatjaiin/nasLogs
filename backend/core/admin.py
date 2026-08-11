from django.contrib import admin
from .models import Organization, Project, Cluster

admin.site.register(Organization)
admin.site.register(Project)
admin.site.register(Cluster)
