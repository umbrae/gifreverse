requirejs.config({
    baseUrl: 'assets/js/lib',
    paths: {
        app: '../app'
    },
    map: {
        '*': { 'jquery': 'jquery-private' },
        'jquery-private': { 'jquery': 'jquery' }
    }
});

require(['jquery', 'jsgif', 'gifjs', 'app/gifreverse'], function($, jsgif, gifjs, gifreverse) {
    $(document).ready(gifreverse.init);
});