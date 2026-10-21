
from cloudinary_storage.storage import MediaCloudinaryStorage


class AudioCloudinaryStorage(MediaCloudinaryStorage):
    RESOURCE_TYPE = "video"
