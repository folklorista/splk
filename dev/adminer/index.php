<?php

class AllowEmptyPasswordPlugin {
    function login($login, $password) {
        return true;
    }
}

function adminer_object() {
    // Adminer customization allowing usage of plugins
    require_once "./plugin.php";

    foreach (glob("plugins/*.php") as $filename) {
        include_once "./$filename";
    }

    return new AdminerPlugin([
        new AllowEmptyPasswordPlugin(),
        // new AdminerTreeViewer("plugins/AdminerTreeViewer.js"),
        new AdminerEditForeign(),
        new AdminerDisplayForeignKeyName(),
        new AdminerTablesFilter()
    ]);
}

// include original Adminer or Adminer Editor
include './latest-cs.php';
?>
