# vserve

I tiny media server that transcodes media on the fly to see in your browser.

## Usage

Place videos in a videos directory inside the project root.

```sh
mkdir videos
cp ~/Videos/*.mp4 videos/
```

Run the server

```sh
cargo run
```

Then open browser to port 3000

```sh
firefox http://localhost:3000
```

I don't know, figure it out.

Works on Firefox. Doesn't work on chrome for some reason, probably unsupported MIME type
