
from rest_framework import serializers
from .models import Song


class SongSerializer(serializers.ModelSerializer):
    audio_url = serializers.SerializerMethodField()

    class Meta:
        model = Song
        fields = [
            "id",
            "title",
            "artist",
            "audio_url",
            "is_shared",
            "created_at",
        ]
        read_only_fields = fields

    def get_audio_url(self, obj):
        request = self.context.get("request")
        if not obj.audio_file:
            return None

        url = obj.audio_file.url
        return request.build_absolute_uri(url) if request else url
