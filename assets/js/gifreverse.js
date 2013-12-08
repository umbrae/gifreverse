/**
 * !GIF Reverse : Reverse GIF!
**/
(function() {
    var frames = [],
        frameDelays = [],
        tmpCanvas = document.createElement('canvas'),
        frameDelay = null,
        gifStream = null,
        gifBlob = null,
        lastDisposalMethod = null,
        disposalMethod = null,
        transparency = null,
        timerStart = null,
        imgurClientId = "26ac2752449813f", /* Public imgur API key */
        headerProps = {
            "globalColorTable": null,
            "bgColor": null
        };

    /**
     * Send to google analytics if we have it loaded.
    **/
    function trackEvent(category, action, label, value) {
        if (ga) {
            ga('send', 'event', category, action, label, value);
        }
    }

    /**
     * Display an error, and revert back to default state.
    **/
    function showError(msg) {
        trackEvent('convert', 'error');
        $('.gif-drop-icon').removeClass('spin');
        $('.gif-drop-text').html($('.gif-drop-text').data('orig-html'));

        // Todo proper error msg
        alert(msg);
    }

    /**
     * Update our progress bar. If max is specified, update the max.
    **/
    function progress(v, max) {
        var $prog = $('#convert-progress');

        $prog.css('display', 'block');
        $prog.val(v);

        if (max) {
            $prog.attr('max', max);
        }
    }

    function loading(status) {
        $('.gif-drop-icon').addClass('spin');
        if (!$('.gif-drop.text').data('orig-html')) {
            $('.gif-drop-text').data('orig-html', $('.gif-drop-text').html());
        }
        $('.gif-drop-text').text(status);
    }

    /**
     * Parse the header of the GIF, set variables we'll need later.
    **/
    function parseHeader(hdr) {
        tmpCanvas.width  = hdr.width;
        tmpCanvas.height = hdr.height;
        headerProps.globalColorTable = hdr.gct;
        headerProps.bgColor = hdr.bgColor;

        /* Set length as double so that we'll only ever get to 50%. The other 50% is for encoding. */
        progress(0, gifStream.data.length * 2);
    }

    /**
     * Parse the Graphics Control Extension section of the GIF. Holds essentially metadata per frame.
    **/
    function parseGCE(gce) {
        frameDelay = (gce.delayTime * 10) || 20; // jsgif uses centiseconds, gif.js milliseconds

        /* anything < 20ms gets clobbered by most browsers */
        if (frameDelay < 20) {
            frameDelay = 20;
        }

        frameDelays.push(frameDelay);

        transparency = gce.transparencyGiven ? gce.transparencyIndex : null;
        lastDisposalMethod = disposalMethod;
        disposalMethod = gce.disposalMethod || 2; // If it's 0, it's almost always meant to be 2.
    }

    /**
     * Parse a single frame of the gif, map it to the color table we've been provided and push it onto our
     * calculated frames. Much of this is syntactically similar to jsgif's bookmarklet demo.
    **/
    function parseImg(img) {
        var frame = tmpCanvas.getContext('2d'),
            cData = frame.getImageData(img.leftPos, img.topPos, img.width, img.height),
            ct    = img.lctFlag ? img.lct : headerProps.globalColorTable;

        /* Go through each pixel and map it to the color table we're using for this frame. */
        img.pixels.forEach(function(pixel, i) {
            // cData.data === [R,G,B,A,...]
            // This includes null, if no transparency was defined.
            if (transparency !== pixel) {
                cData.data[i * 4 + 0] = ct[pixel][0];
                cData.data[i * 4 + 1] = ct[pixel][1];
                cData.data[i * 4 + 2] = ct[pixel][2];
                cData.data[i * 4 + 3] = 255; // Opaque.
            } else if (lastDisposalMethod === 2 || lastDisposalMethod === 3) {
                // TODO: Transparency isn't working properly. Best thing we can do is set the
                // background color for now.
                cData.data[i * 4 + 0] = headerProps.globalColorTable[headerProps.bgColor][0];
                cData.data[i * 4 + 1] = headerProps.globalColorTable[headerProps.bgColor][1];
                cData.data[i * 4 + 2] = headerProps.globalColorTable[headerProps.bgColor][2];
                cData.data[i * 4 + 3] = 255; // Opaque, but it *should* be 0, transparent, when fixed.
            } else if (lastDisposalMethod === null) {
                // First frame probably, set background color.
                cData.data[i * 4 + 0] = headerProps.globalColorTable[headerProps.bgColor][0];
                cData.data[i * 4 + 1] = headerProps.globalColorTable[headerProps.bgColor][1];
                cData.data[i * 4 + 2] = headerProps.globalColorTable[headerProps.bgColor][2];
                cData.data[i * 4 + 3] = 255; // Opaque.                
            }
            // Otherwise, the disposal method Do Not Dispose, which means the pixel is left in place.
        });

        progress(gifStream.pos);

        // Put the image onto the canvas, then re-fetch the whole thing
        // to get the whole image from 0, 0.
        frame.putImageData(cData, img.leftPos, img.topPos);
        frames.push(frame.getImageData(0,0,tmpCanvas.width,tmpCanvas.height));
    }

    /**
     * Parse the end of the decoded GIF. Fire off the encoding process.
    **/
    function parseEOF(block) {
        // Nothing to do with end block just yet.
        encodeGIF();
    }

    /**
     * Encode the frames into our reversed gif.
    **/
    function encodeGIF() {
        var gif = new GIF({
          workers: 8, // Todo: figure out the best numbers here
          quality: 5,
          workerScript: "assets/js/gif_js/gif.worker.js"
        });

        /* Reset progress size to number of frames to encode, starting at 50% done. */
        progress((frames.length / 2) + 1, frames.length);

        /* Run through our frames in reverse, adding 'em. */
        for (var i = frames.length-1; i >= 0; i--) {
            gif.addFrame(frames[i], {"delay": frameDelays[i]});
        }

        var halfDone = parseInt(frames.length/2, 10);
        gif.on('progress', function(pct) {
            progress(halfDone + (halfDone * pct));
        });

        gif.on('finished', function(blob) {
            gifBlob = blob;
            $('.gif').attr('src', URL.createObjectURL(blob)).addClass('finished');
            $('#convert-progress, .gif-drop-icon, .gif-drop-text').hide();
            $('#send-to-imgur').css('visibility', 'visible');
            timing = (new Date().getTime()) - timerStart;
            trackEvent('convert', 'finish', 'timing', timing);
        });

        gif.render();
    }

    function sendToImgur() {
        var b64reader = new FileReader();
        b64reader.onload = function(event) {
            // Remove data URL bit, leave only b64 chewy goodness.
            payload = event.target.result.substring(22);

            $.ajax({
              url: 'https://api.imgur.com/3/image',
              method: 'POST',
              headers: {
                Authorization: 'Client-ID ' + imgurClientId,
                Accept: 'application/json'
              },
              data: {
                "image": payload,
                "type": "base64"
              },
              success: function(result) {
                trackEvent('sendtoimgur', 'finish');
                var id = result.data.id;
                window.location = 'https://imgur.com/gallery/' + id;
              },
              error: function(jqXHR, textStatus, errorThrown) {
                trackEvent('sendtoimgur', 'error', errorThrown);
                alert("Sorry, we had an error sending this to imgur. Maybe upload it yourself? :\\");
              }
            });
        };

        if ($('#send-to-imgur').is('.sending')) {
            return false;
        }

        $('#send-to-imgur').addClass('sending');
        $('.send-status').text('Sending');

        trackEvent('sendtoimgur', 'start');
        b64reader.readAsDataURL(gifBlob);
    }

    /**
     * When someone drags a file over our dropzone, change the icon properly.
    **/
    function handleDragOver(e) {
        e.stopPropagation();
        e.preventDefault();
        $(this).addClass('drag');
        e.originalEvent.dataTransfer.dropEffect = 'copy'; // show the right icon
    }

    function handleGifLoad(gifStream) {
        var handlers = {
            "hdr": parseHeader,
            "gce": parseGCE,
            "img": parseImg,
            "eof": parseEOF
        };

        loading('Backwardsing...');
        trackEvent('convert', 'start');
        timerStart = (new Date().getTime());

        try {
            parseGIF(gifStream, handlers);
        } catch(error) {
            showError("Couldn't read this file. Is it an animated gif?");
        }
    }

    /**
     * Start converting an image provided from either drag/drop or file input events.
    **/
    function handleSelect(e) {
        var file,
            reader = new FileReader();

        e.stopPropagation();
        e.preventDefault();

        reader.onload = function(e) {
            window.result = e.target.result;
            gifStream = new Stream(e.target.result);
            handleGifLoad(gifStream);
        };

        if (e.originalEvent.dataTransfer) {
            /* Drag/drop */
            file = e.originalEvent.dataTransfer.files[0];
        } else {
            /* File input */
            file = e.target.files[0];
        }

        reader.readAsBinaryString(file);
    }

    function sendNonImgurUrlToImgur(url) {

    }

    function handleUrlUpload(url) {
        var a = document.createElement('a');
        a.href = url;

        // Not well-formed data, fail silently
        if (!url || a.host === window.location.host) {
            return false;
        }

        if (a.host === "imgur.com") {
            url = "http://i.imgur.com" + a.pathname + ".gif";
        } else if (a.host !== "i.imgur.com") {
            trackEvent('uploadUrl', 'error', 'nonImgurUrl');
            alert("Sorry, right now we only support imgur URLs.");
            return false;
        }

        loading('Fetching...');

        $.ajax({
          url: url,
          method: 'GET',
          beforeSend: function( xhr ) {
            // Override mimetype so that we get the raw bits back.
            xhr.overrideMimeType( "text/plain; charset=x-user-defined" );
          },
          success: function(result, xhr) {
            gifStream = new Stream(result);
            handleGifLoad(gifStream);
          },
          error: function(jqXHR, textStatus, errorThrown) {
            trackEvent('uploadUrl', 'error', errorThrown);
            alert("Sorry, we had an error fetching this image. Maybe download it and upload it yourself? :\\");
          }
        });
    }

    /**
     * Do... the things.
    **/
    function init() {
        if (!window.File || !window.FileReader || !window.FileList || !window.Blob) {
            showError('Sorry, it looks like your browser doesn\'t support the capabilities needed to use GIF Reverse.');
        }

        $('.gif-drop')
            .on('dragover', handleDragOver)
            .on('dragleave', function() { $(this).removeClass('drag'); })
            .on('drop', handleSelect);

        $("#source-chooser").on('click', function () {
            $("#source-gif").trigger('click');
        });

        $('#source-gif').on('change', handleSelect);
        $('#source-url').on('click', function() {
            var url = prompt("Enter URL:");
            return handleUrlUpload(url);
        });

        $('body').on('paste', function(e) {
            return handleUrlUpload(e.originalEvent.clipboardData.getData('text/plain'));
        });

        $('#send-to-imgur').click(sendToImgur);
    }

    $(document).ready(init);
}());