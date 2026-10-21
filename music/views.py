
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.shortcuts import get_object_or_404

from rest_framework import status
from rest_framework.decorators import (
    api_view,
    permission_classes,
    parser_classes,
)
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.authtoken.models import Token

from .models import Song, PersonalSong
from .serializers import SongSerializer


# USER REGISTRATION
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")

    if not username or not password:
        return Response(
            {"error": "Username and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(password) < 8:
        return Response(
            {"error": "Password must be at least 8 characters."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if User.objects.filter(username=username).exists():
        return Response(
            {"error": "Username already exists."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = User.objects.create_user(
        username=username,
        password=password,
    )

    token, _ = Token.objects.get_or_create(user=user)

    return Response(
        {
            "message": "Account created.",
            "token": token.key,
            "username": user.username,
        },
        status=status.HTTP_201_CREATED,
    )


# USER LOGIN
@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get("username", "").strip()
    password = request.data.get("password", "")

    user = authenticate(
        request,
        username=username,
        password=password,
    )

    if user is None:
        return Response(
            {"error": "Invalid username or password."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    token, _ = Token.objects.get_or_create(user=user)

    return Response(
        {
            "message": "Login successful.",
            "token": token.key,
            "username": user.username,
        }
    )


# USER LOGOUT
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    Token.objects.filter(user=request.user).delete()

    return Response({"message": "Logged out successfully."})


# VIEW LOGGED-IN USER'S PERSONAL LIBRARY
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_songs(request):
    songs = (
        Song.objects.filter(personalsong__user=request.user)
        .distinct()
        .order_by("-created_at")
    )

    serializer = SongSerializer(
        songs,
        many=True,
        context={"request": request},
    )

    return Response(serializer.data)


# SAVE A SHARED SONG OR OWN PERSONAL SONG
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def save_song(request, song_id):
    song = get_object_or_404(
        Song.objects.filter(is_shared=True)
        | Song.objects.filter(
            uploaded_by=request.user,
            is_shared=False,
        ),
        id=song_id,
    )

    _, created = PersonalSong.objects.get_or_create(
        user=request.user,
        song=song,
    )

    return Response(
        {
            "message": (
                "Song saved."
                if created
                else "Song already in your library."
            )
        },
        status=(
            status.HTTP_201_CREATED
            if created
            else status.HTTP_200_OK
        ),
    )


# REMOVE A SONG FROM THE USER'S LIBRARY
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def remove_song(request, song_id):
    PersonalSong.objects.filter(
        user=request.user,
        song_id=song_id,
    ).delete()

    return Response(status=status.HTTP_204_NO_CONTENT)


# VIEW PUBLICLY SHARED SONGS
@api_view(["GET"])
@permission_classes([AllowAny])
def shared_songs(request):
    songs = Song.objects.filter(
        is_shared=True
    ).order_by("-created_at")

    serializer = SongSerializer(
        songs,
        many=True,
        context={"request": request},
    )

    return Response(serializer.data)


# OWNER-ONLY SHARED SONG UPLOAD
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_song(request):
    if not request.user.is_staff:
        return Response(
            {"error": "Only the authorized owner can upload shared songs."},
            status=status.HTTP_403_FORBIDDEN,
        )

    title = request.data.get("title", "").strip()
    artist = request.data.get("artist", "").strip()
    audio_file = request.FILES.get("audio_file")

    if not title or not audio_file:
        return Response(
            {"error": "Title and audio file are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    song = Song.objects.create(
        title=title,
        artist=artist,
        audio_file=audio_file,
        uploaded_by=request.user,
        is_shared=True,
    )

    serializer = SongSerializer(
        song,
        context={"request": request},
    )

    return Response(
        serializer.data,
        status=status.HTTP_201_CREATED,
    )


# UPLOAD A SONG TO THE LOGGED-IN USER'S PERSONAL LIBRARY
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_personal_song(request):
    title = request.data.get("title", "").strip()
    artist = request.data.get("artist", "").strip()
    audio_file = request.FILES.get("audio_file")

    if not title or not audio_file:
        return Response(
            {"error": "Title and audio file are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    song = Song.objects.create(
        title=title,
        artist=artist,
        audio_file=audio_file,
        uploaded_by=request.user,
        is_shared=False,
    )

    PersonalSong.objects.create(
        user=request.user,
        song=song,
    )

    serializer = SongSerializer(
        song,
        context={"request": request},
    )

    return Response(
        serializer.data,
        status=status.HTTP_201_CREATED,
    )
