# vserve

I tiny media server that transcodes media on the fly to see in your browser.

## Usage

1. Place edit the script.js file to point to the file path

2. Run the server

```sh
cargo run -- [port]
```

The server runs on port 3000 if the port is not specified.

3. Run the browser

```sh
firefox http://localhost:3000
```

Tested on Fedora server with Firefox, Chrome and Gtk-Webview.

Make sure you have an NVIDIA GPU with proper support for NVDEC and NVENC. The ffmpeg I got from fedora repos(Both official repo and rpm-fusion) didn't work so I compiled my own and added it to path named ffmpeg-next.

## How to compile ffmpeg.

Here are the steps I followed:

1. Check what features your gpu supports at [Nvidia GPU support matrix](https://developer.nvidia.com/video-encode-and-decode-gpu-support-matrix-new)
2. Get the nvidia video sdk files from [Nvidia Website](https://developer.nvidia.com/nvidia-video-codec-sdk/download). This requires an account. Make sure to get the _Video codec for application developers_.
3. Clone the ffmpeg repo.

```sh
git clone https://git.ffmpeg.org/ffmpeg.git
```

4. Configure ffmpeg with the following.

```sh
./configure \
  --prefix=/usr/local \
  --enable-gpl \
  --enable-nonfree \
  --enable-libx264 \
  --enable-libx265 \
  --enable-libvpx \
  --enable-libass \
  --enable-libfdk-aac \
  --enable-libmp3lame \
  --enable-libopus \
  --enable-libvorbis \
  --enable-libtheora \
  --enable-libwebp \
  --enable-libfreetype \
  --enable-libopenjpeg \
  --enable-libaom \
  --enable-librav1e \
  --enable-nvenc \
  --enable-libnpp \
  --enable-cuvid \
  --enable-nvdec \
  --enable-vaapi \
  --enable-vdpau \
  --enable-opengl \
  --extra-cflags="-I../nvidia-video-sdk/include" \
  --extra-ldflags="-L../nvidia-video-sdk/lib" \
  --extra-cflags="-I/usr/local/cuda/include" \
  --extra-ldflags="-L/usr/local/cuda/lib64"
```

If the script complains about missing libraries, install them. The native ones I got from fedora repos work. The Arch ones will work too I believe. Make sure to install the _devel_ or _dev_ packages if that's how your distro works.

5. Build ffmpeg.

```sh
make -j$(nproc)
```

6. Copy ffmpeg to a place in your path. I copied it to `~/.local/bin/ffmpeg-next`.
