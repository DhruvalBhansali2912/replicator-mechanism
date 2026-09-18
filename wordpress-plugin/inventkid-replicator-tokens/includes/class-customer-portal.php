<?php
/**
 * Customer Portal: Thank You Page, My Account Tab, and Order Emails
 */

if (!defined('ABSPATH')) {
    exit;
}

class InventKid_Replicator_Customer_Portal {

    public static function init() {
        // Thank you page display
        add_action('woocommerce_thankyou', [__CLASS__, 'render_thankyou_license_card'], 5);

        // Order emails
        add_action('woocommerce_email_order_meta', [__CLASS__, 'render_email_license_info'], 10, 3);

        // My Account Tab
        add_action('init', [__CLASS__, 'add_my_account_endpoint']);
        add_filter('woocommerce_account_menu_items', [__CLASS__, 'add_my_account_menu_item']);
        add_action('woocommerce_account_replicator-license_endpoint', [__CLASS__, 'render_my_account_page']);

        // Handle Device Reset POST from My Account
        add_action('template_redirect', [__CLASS__, 'handle_device_reset_request']);
    }

    /**
     * Render license card on WooCommerce Thank You / Order Received page
     */
    public static function render_thankyou_license_card($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        $api_key = $order->get_meta('_replicator_api_key');
        $tokens  = $order->get_meta('_replicator_tokens_granted');
        $balance = $order->get_meta('_replicator_balance');

        if (!$api_key) {
            return;
        }

        $existing_key = $order->get_meta('_replicator_existing_api_key');
        $is_recharge = !empty($existing_key);

        ?>
        <div class="inventkid-license-box" style="margin: 25px 0; padding: 25px; background: #f8fafc; border: 2px solid <?php echo $is_recharge ? '#16a34a' : '#3b82f6'; ?>; border-radius: 10px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <span style="font-size: 24px;"><?php echo $is_recharge ? '⚡' : '🔑'; ?></span>
                <div>
                    <h3 style="margin: 0; font-size: 18px; color: #1e293b;">
                        <?php echo $is_recharge ? __('Replicator Tokens Recharged!', 'inventkid-replicator') : __('Your Replicator Extension License Key', 'inventkid-replicator'); ?>
                    </h3>
                    <p style="margin: 3px 0 0; color: #64748b; font-size: 13px;">
                        <?php printf(__('Granted: +%d tokens | Total Balance: %d tokens', 'inventkid-replicator'), $tokens, $balance); ?>
                    </p>
                </div>
            </div>

            <p style="font-size: 14px; color: #334155; margin-bottom: 10px;">
                <?php echo $is_recharge ? __('Your Replicator Chrome Extension key has been credited directly:', 'inventkid-replicator') : __('Use this license key in your Chrome Extension to activate your page replication credits:', 'inventkid-replicator'); ?>
            </p>

            <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 15px;">
                <input type="text" id="inventkid-api-key-input" value="<?php echo esc_attr($api_key); ?>" readonly style="flex: 1; font-family: monospace; font-size: 15px; font-weight: bold; padding: 10px 14px; background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a;" />
                <button type="button" id="btn-copy-license" class="button" style="background: <?php echo $is_recharge ? '#16a34a' : '#2563eb'; ?>; color: #fff; padding: 10px 18px; font-weight: 600; border-radius: 6px; border: none; cursor: pointer;">
                    <?php _e('Copy Key', 'inventkid-replicator'); ?>
                </button>
            </div>

            <div style="background: <?php echo $is_recharge ? '#f0fdf4' : '#eff6ff'; ?>; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: <?php echo $is_recharge ? '#166534' : '#1e40af'; ?>;">
                <strong><?php _e('Status:', 'inventkid-replicator'); ?></strong>
                <?php if ($is_recharge): ?>
                    <?php _e('Your Chrome extension key has been recharged automatically. Simply open the extension popup to start cloning immediately!', 'inventkid-replicator'); ?>
                <?php else: ?>
                    <?php _e('1. Open the Replicator Chrome Extension.<br>2. Paste your License Key above.<br>3. The key will automatically bind to your browser and you can start cloning!', 'inventkid-replicator'); ?>
                <?php endif; ?>
            </div>
        </div>

        <script>
        document.getElementById('btn-copy-license')?.addEventListener('click', function() {
            var input = document.getElementById('inventkid-api-key-input');
            input.select();
            navigator.clipboard.writeText(input.value).then(function() {
                var btn = document.getElementById('btn-copy-license');
                var orig = btn.innerText;
                btn.innerText = '✓ Copied!';
                btn.style.background = '#16a34a';
                setTimeout(function() {
                    btn.innerText = orig;
                    btn.style.background = '#2563eb';
                }, 2000);
            });
        });
        </script>
        <?php
    }

    /**
     * Include license key in customer order emails
     */
    public static function render_email_license_info($order, $sent_to_admin, $plain_text) {
        if ($sent_to_admin) {
            return;
        }

        $api_key = $order->get_meta('_replicator_api_key');
        $tokens  = $order->get_meta('_replicator_tokens_granted');

        if (!$api_key) {
            return;
        }

        if ($plain_text) {
            echo "\n================================================\n";
            echo "YOUR REPLICATOR LICENSE KEY:\n";
            echo $api_key . "\n";
            echo "Tokens Granted: " . $tokens . "\n";
            echo "================================================\n\n";
        } else {
            ?>
            <div style="margin: 20px 0; padding: 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h3 style="margin-top: 0; color: #1e293b;"><?php _e('Your Replicator License Key', 'inventkid-replicator'); ?></h3>
                <p style="margin: 5px 0;"><strong><?php _e('License Key:', 'inventkid-replicator'); ?></strong> <code><?php echo esc_html($api_key); ?></code></p>
                <p style="margin: 5px 0;"><strong><?php _e('Tokens Credited:', 'inventkid-replicator'); ?></strong> +<?php echo esc_html($tokens); ?></p>
                <p style="margin-top: 10px; font-size: 13px; color: #64748b;">
                    <?php _e('Paste this key into your Replicator Chrome Extension to start cloning pages.', 'inventkid-replicator'); ?>
                </p>
            </div>
            <?php
        }
    }

    /**
     * Register My Account endpoint
     */
    public static function add_my_account_endpoint() {
        add_rewrite_endpoint('replicator-license', EP_ROOT | EP_PAGES);
    }

    /**
     * Add tab in My Account menu
     */
    public static function add_my_account_menu_item($items) {
        $new_items = [];
        foreach ($items as $key => $title) {
            $new_items[$key] = $title;
            if ($key === 'orders') {
                $new_items['replicator-license'] = __('Replicator License', 'inventkid-replicator');
            }
        }
        if (!isset($new_items['replicator-license'])) {
            $new_items['replicator-license'] = __('Replicator License', 'inventkid-replicator');
        }
        return $new_items;
    }

    /**
     * Render My Account Replicator License page
     */
    public static function render_my_account_page() {
        $user_id = get_current_user_id();
        $api_key = get_user_meta($user_id, '_replicator_api_key', true);

        if (!$api_key) {
            ?>
            <div class="woocommerce-Message woocommerce-Message--info woocommerce-info">
                <?php _e('You do not have an active Replicator License Key yet. Claim your 3 free credits or purchase a token package in our store to get started!', 'inventkid-replicator'); ?>
            </div>
            <?php
            return;
        }

        // Fetch live balance from Replicator Engine
        $api_url = get_option('inventkid_replicator_api_url', 'http://localhost:3000');
        $secret  = get_option('inventkid_replicator_master_secret', 'repl_sec_dev_key_2026');

        $tokens_balance = get_user_meta($user_id, '_replicator_token_balance', true);
        $bound_device   = null;

        // Query Replicator Engine directly via master secret to get full key details
        $resp = wp_remote_post(trailingslashit($api_url) . 'api/keys/verify', [
            'timeout' => 5,
            'headers' => ['Content-Type' => 'application/json'],
            'body'    => wp_json_encode(['apiKey' => $api_key, 'deviceId' => 'WP_ADMIN_CHECK']),
        ]);

        if (!is_wp_error($resp)) {
            $body = json_decode(wp_remote_retrieve_body($resp), true);
            if (!empty($body['balance']) || isset($body['balance'])) {
                $tokens_balance = $body['balance'];
                $bound_device   = !empty($body['boundDeviceId']) ? $body['boundDeviceId'] : null;
            }
        }

        ?>
        <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 20px;">
            <h3 style="margin-top: 0;"><?php _e('Your Replicator License & Device Status', 'inventkid-replicator'); ?></h3>

            <table class="woocommerce-table" style="width: 100%; margin-bottom: 20px;">
                <tr>
                    <th style="width: 30%;"><?php _e('License Key', 'inventkid-replicator'); ?></th>
                    <td>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input type="text" id="myaccount-api-key" value="<?php echo esc_attr($api_key); ?>" readonly style="font-family: monospace; width: 340px; font-weight: bold;" />
                            <button type="button" class="button" onclick="navigator.clipboard.writeText(document.getElementById('myaccount-api-key').value); alert('Copied to clipboard!');">
                                <?php _e('Copy', 'inventkid-replicator'); ?>
                            </button>
                        </div>
                    </td>
                </tr>
                <tr>
                    <th><?php _e('Remaining Credits', 'inventkid-replicator'); ?></th>
                    <td>
                        <span style="font-size: 18px; font-weight: bold; color: #16a34a;">
                            <?php echo esc_html($tokens_balance); ?> <?php _e('tokens', 'inventkid-replicator'); ?>
                        </span>
                    </td>
                </tr>
                <tr>
                    <th><?php _e('Bound Device', 'inventkid-replicator'); ?></th>
                    <td>
                        <?php if ($bound_device && $bound_device !== 'WP_ADMIN_CHECK') : ?>
                            <span style="color: #0369a1; font-family: monospace;">✓ <?php echo esc_html(substr($bound_device, 0, 16)); ?>...</span>
                        <?php else : ?>
                            <span style="color: #64748b;"><?php _e('Not yet activated on a browser', 'inventkid-replicator'); ?></span>
                        <?php endif; ?>
                    </td>
                </tr>
            </table>

            <div style="padding: 15px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px;">
                <h4 style="margin: 0 0 8px; color: #991b1b;"><?php _e('Switching to a new computer?', 'inventkid-replicator'); ?></h4>
                <p style="margin: 0 0 12px; font-size: 13px; color: #7f1d1d;">
                    <?php _e('Your license key is bound to 1 browser. If you bought a new computer or reinstalled Chrome, reset the device lock below.', 'inventkid-replicator'); ?>
                </p>
                <form method="post">
                    <?php wp_nonce_field('inventkid_reset_device_action', 'inventkid_reset_device_nonce'); ?>
                    <button type="submit" name="inventkid_reset_device_submit" class="button" style="background: #dc2626; color: #fff;" onclick="return confirm('Are you sure you want to unlink your current device?');">
                        <?php _e('Reset Device Binding', 'inventkid-replicator'); ?>
                    </button>
                </form>
            </div>
        </div>
        <?php
    }

    /**
     * Handle device reset form submission from My Account
     */
    public static function handle_device_reset_request() {
        if (isset($_POST['inventkid_reset_device_submit']) && is_user_logged_in()) {
            check_admin_referer('inventkid_reset_device_action', 'inventkid_reset_device_nonce');

            $user_id = get_current_user_id();
            $api_key = get_user_meta($user_id, '_replicator_api_key', true);

            if (!$api_key) {
                return;
            }

            $api_url = get_option('inventkid_replicator_api_url', 'http://localhost:3000');
            $secret  = get_option('inventkid_replicator_master_secret', 'repl_sec_dev_key_2026');

            $resp = wp_remote_post(trailingslashit($api_url) . 'api/keys/reset-device', [
                'timeout' => 8,
                'headers' => [
                    'Authorization' => 'Bearer ' . $secret,
                    'Content-Type'  => 'application/json',
                ],
                'body'    => wp_json_encode([
                    'emailOrKey' => $api_key,
                    'reason'     => 'Customer reset device from My Account',
                ]),
            ]);

            if (!is_wp_error($resp) && wp_remote_retrieve_response_code($resp) === 200) {
                wc_add_notice(__('Device binding has been successfully reset! You can now activate this key on your new device.', 'inventkid-replicator'), 'success');
            } else {
                wc_add_notice(__('Failed to reset device binding. Please try again or contact support.', 'inventkid-replicator'), 'error');
            }

            wp_safe_redirect(wc_get_endpoint_url('replicator-license', '', wc_get_page_permalink('myaccount')));
            exit;
        }
    }
}
