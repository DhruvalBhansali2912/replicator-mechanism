<?php
/**
 * Admin Settings for InventKid Replicator Tokens
 */

if (!defined('ABSPATH')) {
    exit;
}

class InventKid_Replicator_Settings {

    public static function init() {
        add_filter('woocommerce_settings_tabs_array', [__CLASS__, 'add_settings_tab'], 50);
        add_action('woocommerce_settings_tabs_replicator_tokens', [__CLASS__, 'settings_tab_content']);
        add_action('woocommerce_update_options_replicator_tokens', [__CLASS__, 'save_settings']);
        add_action('wp_ajax_inventkid_test_replicator_api', [__CLASS__, 'ajax_test_connection']);
    }

    public static function add_settings_tab($tabs) {
        $tabs['replicator_tokens'] = __('Replicator Tokens', 'inventkid-replicator');
        return $tabs;
    }

    public static function get_settings() {
        return [
            [
                'title' => __('Replicator Engine API Settings', 'inventkid-replicator'),
                'type'  => 'title',
                'desc'  => __('Configure connection to your Node.js Replicator Engine instance.', 'inventkid-replicator'),
                'id'    => 'inventkid_replicator_options',
            ],
            [
                'title'    => __('API Endpoint URL', 'inventkid-replicator'),
                'desc'     => __('Base URL of your Replicator Engine server (e.g. http://localhost:3000 or https://api.yourdomain.com)', 'inventkid-replicator'),
                'id'       => 'inventkid_replicator_api_url',
                'type'     => 'text',
                'default'  => 'http://localhost:3000',
                'css'      => 'min-width:350px;',
                'desc_tip' => true,
            ],
            [
                'title'    => __('Master Secret Token', 'inventkid-replicator'),
                'desc'     => __('Secret token shared between WooCommerce and your Replicator Engine (matches REPLICATOR_MASTER_SECRET in server config).', 'inventkid-replicator'),
                'id'       => 'inventkid_replicator_master_secret',
                'type'     => 'password',
                'default'  => 'repl_sec_dev_key_2026',
                'css'      => 'min-width:350px;',
                'desc_tip' => true,
            ],
            [
                'title'    => __('Default Free Trial Tokens', 'inventkid-replicator'),
                'desc'     => __('Number of free tokens granted when a user claims the free trial product.', 'inventkid-replicator'),
                'id'       => 'inventkid_replicator_default_free_tokens',
                'type'     => 'number',
                'default'  => 3,
                'css'      => 'width:80px;',
            ],
            [
                'type' => 'sectionend',
                'id'   => 'inventkid_replicator_options',
            ],
        ];
    }

    public static function settings_tab_content() {
        woocommerce_admin_fields(self::get_settings());
        ?>
        <div style="margin-top: 20px; padding: 15px; background: #fff; border: 1px solid #ccd0d4; border-radius: 4px; max-width: 600px;">
            <h3><?php _e('Connection Test', 'inventkid-replicator'); ?></h3>
            <p><?php _e('Test if WooCommerce can communicate with your Replicator Engine.', 'inventkid-replicator'); ?></p>
            <button type="button" class="button button-secondary" id="btn-test-replicator-conn">
                <?php _e('Test API Connection', 'inventkid-replicator'); ?>
            </button>
            <span id="replicator-test-result" style="margin-left: 10px; font-weight: bold;"></span>
        </div>

        <script>
        jQuery(document).ready(function($) {
            $('#btn-test-replicator-conn').on('click', function(e) {
                e.preventDefault();
                var $res = $('#replicator-test-result');
                $res.text('Connecting to Replicator Engine...').css('color', '#666');

                $.post(ajaxurl, {
                    action: 'inventkid_test_replicator_api',
                    _wpnonce: '<?php echo wp_create_nonce("inventkid_test_api_nonce"); ?>'
                }, function(resp) {
                    if (resp.success) {
                        $res.text(' Connected! Engine is online.').css('color', '#46b450');
                    } else {
                        $res.text(' ' + (resp.data || 'Connection failed.')).css('color', '#dc3232');
                    }
                }).fail(function() {
                    $res.text(' Network error connecting to engine.').css('color', '#dc3232');
                });
            });
        });
        </script>
        <?php
    }

    public static function save_settings() {
        woocommerce_update_options(self::get_settings());
    }

    public static function ajax_test_connection() {
        check_ajax_referer('inventkid_test_api_nonce');

        if (!current_user_can('manage_woocommerce')) {
            wp_send_json_error(__('Permission denied.', 'inventkid-replicator'));
        }

        $api_url = get_option('inventkid_replicator_api_url', 'http://localhost:3000');
        $secret  = get_option('inventkid_replicator_master_secret', 'repl_sec_dev_key_2026');

        $response = wp_remote_get(trailingslashit($api_url) . 'api/jobs', [
            'timeout' => 8,
            'headers' => [
                'Authorization' => 'Bearer ' . $secret,
            ],
        ]);

        if (is_wp_error($response)) {
            wp_send_json_error($response->get_error_message());
        }

        $code = wp_remote_retrieve_response_code($response);
        if ($code === 200) {
            wp_send_json_success(__('Replicator Engine is reachable and operating.', 'inventkid-replicator'));
        } else {
            wp_send_json_error(sprintf(__('Server returned HTTP %d', 'inventkid-replicator'), $code));
        }
    }
}
