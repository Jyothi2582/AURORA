

from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.register, name="register"),
    path("login/", views.login, name="login"),
    path("logout/", views.logout, name="logout"),
    path("songs/mine/", views.my_songs, name="my_songs"),
    path("songs/shared/", views.shared_songs, name="shared_songs"),
    path("songs/<int:song_id>/save/", views.save_song, name="save_song"),
    path("songs/<int:song_id>/remove/", views.remove_song, name="remove_song"),
    path("songs/upload/", views.upload_song, name="upload_song"),
    path("songs/upload-personal/", views.upload_personal_song, name="upload_personal_song"),
]
