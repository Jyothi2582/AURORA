
import logging
from django.contrib import admin
from .models import Song, PersonalSong

logger = logging.getLogger(__name__)


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    list_display = ("title", "artist", "uploaded_by", "is_shared", "created_at")
    list_filter = ("is_shared",)
    search_fields = ("title", "artist", "uploaded_by__username")

    def save_model(self, request, obj, form, change):
        try:
            super().save_model(request, obj, form, change)
        except Exception:
            logger.exception("AURORA: Failed to save uploaded song")
            raise


@admin.register(PersonalSong)
class PersonalSongAdmin(admin.ModelAdmin):
    list_display = ("user", "song", "saved_at")
    search_fields = ("user__username", "song__title")
