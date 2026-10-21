
from django.contrib import admin
from .models import Song, PersonalSong


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    list_display = ("title", "artist", "uploaded_by", "is_shared", "created_at")
    list_filter = ("is_shared",)
    search_fields = ("title", "artist", "uploaded_by__username")


@admin.register(PersonalSong)
class PersonalSongAdmin(admin.ModelAdmin):
    list_display = ("user", "song", "saved_at")
    search_fields = ("user__username", "song__title")
