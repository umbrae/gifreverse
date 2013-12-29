requirejs.config({
    baseUrl: 'assets/js/lib',
    paths: {
        app: '../app'
    }
});

require(['jquery', 'jsgif', 'gifjs', 'app/gifreverse'], function($, jsgif, gifjs, gifreverse) {
    $(document).ready(gifreverse.init);
});