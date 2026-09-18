<?php
/**
 * Plugin Name: InventKid Replicator Tokens for WooCommerce
 * Plugin URI:  https://inventkid.com
 * Description: Sells page replication credits via WooCommerce, generates device-locked API keys, enforces anti-abuse on free trial tokens, and integrates seamlessly with the Replicator Chrome Extension.
 * Version:     1.0.0
 * Author:      InventKid
 * Author URI:  https://inventkid.com
 * Text Domain: inventkid-replicator
 * Domain Path: /languages
 * Requires at least: 5.8
 * Requires PHP: 7.4
 * WC requires at least: 5.0
 */

if (!defined('ABSPATH')) {
    exit;
}

define('INVENTKID_REPLICATOR_VERSION', '1.0.0');
define('INVENTKID_REPLICATOR_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('INVENTKID_REPLICATOR_PLUGIN_URL', plugin_dir_url(__FILE__));

class InventKid_Replicator_Tokens_Plugin {

    private static $instance = null;

    public static function instance() {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function __construct() {
        add_action('plugins_loaded', [$this, 'init']);
        register_activation_hook(__FILE__, [$this, 'activate']);
        register_deactivation_hook(__FILE__, [$this, 'deactivate']);
    }

    public function init() {
        // Ensure WooCommerce is installed and active
        if (!class_exists('WooCommerce')) {
            add_action('admin_notices', [$this, 'woocommerce_missing_notice']);
            return;
        }

        $this->includes();
    }

    private function includes() {
        require_once INVENTKID_REPLICATOR_PLUGIN_DIR . 'includes/class-admin-settings.php';
        require_once INVENTKID_REPLICATOR_PLUGIN_DIR . 'includes/class-product-fields.php';
        require_once INVENTKID_REPLICATOR_PLUGIN_DIR . 'includes/class-anti-abuse.php';
        require_once INVENTKID_REPLICATOR_PLUGIN_DIR . 'includes/class-order-handler.php';
        require_once INVENTKID_REPLICATOR_PLUGIN_DIR . 'includes/class-customer-portal.php';

        InventKid_Replicator_Settings::init();
        InventKid_Replicator_Product_Fields::init();
        InventKid_Replicator_Anti_Abuse::init();
        InventKid_Replicator_Order_Handler::init();
        InventKid_Replicator_Customer_Portal::init();
    }

    public function woocommerce_missing_notice() {
        ?>
        <div class="notice notice-error">
            <p><?php _e('<strong>InventKid Replicator Tokens</strong> requires WooCommerce to be installed and activated.', 'inventkid-replicator'); ?></p>
        </div>
        <?php
    }

    public function activate() {
        // Flush rewrite rules on activation for My Account endpoint
        if (class_exists('WooCommerce')) {
            require_once INVENTKID_REPLICATOR_PLUGIN_DIR . 'includes/class-customer-portal.php';
            InventKid_Replicator_Customer_Portal::add_my_account_endpoint();
            flush_rewrite_rules();
        }
    }

    public function deactivate() {
        flush_rewrite_rules();
    }
}

function inventkid_replicator_tokens() {
    return InventKid_Replicator_Tokens_Plugin::instance();
}

inventkid_replicator_tokens();
