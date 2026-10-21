
from django.conf import settings
from django.db import models


class Song(models.Model):
    title = models.CharField(max_length=200)
    artist = models.CharField(max_length=200, blank=True)
    audio_file = models.FileField(upload_to="songs/")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="uploaded_songs",
    )
    is_shared = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class PersonalSong(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="personal_songs",
    )
    song = models.ForeignKey(
        Song,
        on_delete=models.CASCADE,
        related_name="saved_by_users",
    )
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "song"],
                name="unique_personal_song",
            )
        ]

    def __str__(self):
        return f"{self.user.username} - {self.song.title}"
