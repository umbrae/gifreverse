if (window.File && window.FileReader && window.FileList && window.Blob) {
    // Great success! All the File APIs are supported.
} else {
    alert('The File APIs are not fully supported in this browser.');
}

window.frames = [];
window.tmpCanvas = document.createElement('canvas');
window.sampleImg = document.getElementById('sampleImg');
window.transparency = null;
window.gif_header = null;

function handleFileSelect(evt) {
    var file = evt.target.files[0],
        reader = new FileReader();

    if (!file) {
        return;
    }

    reader.onload = function(e) {
        console.log(e);
        console.log(e.target);
        window.e = e;

        var handler = {
            hdr: function(hdr) {
                // canvas.width = hdr.width;
                // canvas.height = hdr.height;
                // div.style.width = hdr.width + 'px';
                //div.style.height = hdr.height + 'px';
                // toolbar.style.minWidth = hdr.width + 'px';
                tmpCanvas.width = hdr.width;
                tmpCanvas.height = hdr.height;
                //if (hdr.gctFlag) { // Fill background.
                //  rgb = hdr.gct[hdr.bgColor];
                //  tmpCanvas.fillStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',');
                //}
                //tmpCanvas.getContext('2d').fillRect(0, 0, hdr.width, hdr.height);
                // TODO: Figure out the disposal method business.

                window.gif_header = hdr;
            },
            gce: function(gce) {
                transparency = gce.transparencyGiven ? gce.transparencyIndex : null;
                delay = gce.delayTime;
                disposalMethod = gce.disposalMethod;
                // We don't have much to do with the rest of GCE.
            },
            img: function(img) {
                var frame = tmpCanvas.getContext('2d');
                var cData = frame.getImageData(img.leftPos, img.topPos, img.width, img.height);
                var ct = img.lctFlag ? img.lct : gif_header.gct; // TODO: What if neither exists?

                img.pixels.forEach(function(pixel, i) {
                    // cData.data === [R,G,B,A,...]
                    if (transparency !== pixel) { // This includes null, if no transparency was defined.
                        cData.data[i * 4 + 0] = ct[pixel][0];
                        cData.data[i * 4 + 1] = ct[pixel][1];
                        cData.data[i * 4 + 2] = ct[pixel][2];
                        cData.data[i * 4 + 3] = 255; // Opaque.
                    } else {
                        // TODO: Handle disposal method properly.
                        // XXX: When I get to an Internet connection, check which disposal method is which.
                        if (lastDisposalMethod === 2 || lastDisposalMethod === 3) {
                            cData.data[i * 4 + 3] = 0; // Transparent.
                            // XXX: This is very very wrong.
                        } else {
                            // lastDisposalMethod should be null (no GCE), 0, or 1; leave the pixel as it is.
                            // assert(lastDispsalMethod === null || lastDispsalMethod === 0 || lastDispsalMethod === 1);
                            // XXX: If this is the first frame (and we *do* have a GCE),
                            // lastDispsalMethod will be null, but we want to set undefined
                            // pixels to the background color.
                        }
                    }
                });

                // If I'm understanding this right, put the image onto the canvas, then re-fetch the whole thing
                // to get the whole image without compression
                frame.putImageData(cData, img.leftPos, img.topPos);
                var frameData = frame.getImageData(0,0,tmpCanvas.width,tmpCanvas.height);

//                sampleImg.src = tmpCanvas.toDataURL("image/gif");

                window.frames.push(frameData);

                // We could use the on-page canvas directly, except that we draw a progress
                // bar for each image chunk (not just the final image).
//                ctx.putImageData(cData, img.leftPos, img.topPos);
//                console.log(img);
//                window.frames.push(img);
            },
            eof: function(block) {
                window.block = block;
                console.log(block);

                var gif = new GIF({
                  workers: 2,
                  quality: 10
                });

                for(var i=window.frames.length-1; i >= 0; i--) {
                    gif.addFrame(window.frames[i], {delay: 10});
                }

                gif.on('finished', function(blob) {
                  window.open(URL.createObjectURL(blob));
                });
                gif.render();

                console.log(window.GIF);
            }
        };

        var st = new Stream(e.target.result);
        console.log(st);

        parseGIF(st, handler);
    };

    console.log(file);
    window.f = file;

    reader.readAsBinaryString(file);


}

document.getElementById('source_gif').addEventListener('change', handleFileSelect, false);