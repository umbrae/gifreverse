// TODO: This entire file is complete prototyping garbage. Clean it up.

// TODO: Figure out real requirements and test for 'em
if (window.File && window.FileReader && window.FileList && window.Blob) {
    // Great success! All the File APIs are supported.
} else {
    alert('The File APIs are not fully supported in this browser.');
}

// Todo ugh, close all of this.
window.frames = [];
window.tmpCanvas = document.createElement('canvas');
window.sampleImg = document.getElementById('sampleImg');
window.transparency = null;
window.gif_header = null;
window.disposalMethod = null;
window.delay = null;
window.gifstream = null;

function showError(msg) {
    $('.gif-drop-icon').removeClass('spin');
    $('.gif-drop-text').html($('.gif-drop-text').data('orig-html'));

    // Todo proper error msg
    alert(msg);
}

function updateProgressMax(v) {
    $('#convert-progress').attr('max', v);
}

function updateProgress(v) {
    $('#convert-progress').css('display', 'block').val(v);
}

function handleFileSelect(evt) {
    var file;
        reader = new FileReader();

    if (evt.originalEvent.dataTransfer) {
        /* Drag/drop */
        file = evt.originalEvent.dataTransfer.files[0];
    } else {
        /* File input */
        file = evt.target.files[0];
    }

    evt.stopPropagation();
    evt.preventDefault();

    $('.gif-drop-icon').addClass('spin');
    $('.gif-drop-text').data('orig-html', $('.gif-drop-text').html());
    $('.gif-drop-text').text('Backwardsing...');

    reader.onload = function(e) {

        /** Note: A lot of this is pulled wholesale from jsgif's demo bookmarklet. **/
        var handler = {
            /**
             * Deal with the header of the gif. Particularly, set our processing canvas width and height.
            **/
            hdr: function(hdr) {
                tmpCanvas.width = hdr.width;
                tmpCanvas.height = hdr.height;

                // Todo: Get rid of this mess.
                window.gif_header = hdr;

                // Only go to 50% for decoding
                updateProgressMax(window.gifstream.data.length * 2);
            },
            gce: function(gce) {
                window.transparency = gce.transparencyGiven ? gce.transparencyIndex : null;
                window.delay = gce.delayTime || 4;
                window.disposalMethod = gce.disposalMethod;
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
                        if (window.disposalMethod === 2 || window.disposalMethod === 3) {
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

                updateProgress(window.gifstream.pos);

                // If I'm understanding this right, put the image onto the canvas, then re-fetch the whole thing
                // to get the whole image without compression
                frame.putImageData(cData, img.leftPos, img.topPos);
                var frameData = frame.getImageData(0,0,tmpCanvas.width,tmpCanvas.height);
                window.frames.push(frameData);
            },
            eof: function(block) {
                var gif = new GIF({
                  workers: 8, // Todo: figure out the best numbers here
                  quality: 5,
                  workerScript: "assets/js/gif_js/gif.worker.js"
                });

                updateProgressMax(window.frames.length);
                updateProgress((window.frames.length / 2) + 1);

                for (var i = window.frames.length-1; i >= 0; i--) {
                    gif.addFrame(window.frames[i], {delay: window.delay});
                }

                gif.on('progress', function(pct) {
                    updateProgress(parseInt(window.frames.length/2, 10) + parseInt((window.frames.length/2) * pct, 10));
                });

                gif.on('finished', function(blob) {
                    $('.gif').attr('src', URL.createObjectURL(blob)).addClass('finished');
                    $('#convert-progress, .gif-drop-icon, .gif-drop-text').hide();
                });
                gif.render();
            }
        };

        window.gifstream = new Stream(e.target.result);
        var st = window.gifstream;

        try {
            parseGIF(window.gifstream, handler);
        } catch(err) {
            showError("Couldn't read this file. Is it an animated gif?");
        }
    };

    reader.readAsBinaryString(file);
}

function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.originalEvent.dataTransfer.dropEffect = 'copy'; // show the right icon
}

$('.gif-drop')
    .on('dragover', handleDragOver)
    .on('drop', handleFileSelect);

$("#source-chooser").on('click', function () {
    $("#source-gif").trigger('click');
});

$('#source-gif').change(handleFileSelect);
