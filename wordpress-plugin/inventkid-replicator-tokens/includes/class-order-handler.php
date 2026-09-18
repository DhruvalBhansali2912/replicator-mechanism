<?php
/**
 * Order Completion Handler to Grant Replicator Tokens via API
 */

if (!defined('ABSPATH')) {
    exit;
}

class InventKid_Replicator_Order_Handler {

    public static function init() {
        add_action('woocommerce_order_status_completed', [__CLASS__, 'handle_order_completed'], 10, 1);
        add_action('woocommerce_order_status_processing', [__CLASS__, 'handle_order_completed'], 10, 1);

        // Checkout field for existing API Key
        add_action('woocommerce_after_order_notes', [__CLASS__, 'render_checkout_api_key_field']);
        add_action('woocommerce_checkout_update_order_meta', [__CLASS__, 'save_checkout_api_key_field']);
    }

    /**
     * Display optional API key field on checkout if cart has replicator token products
     */
    public static function render_checkout_api_key_field($checkout) {
        if (!self::cart_contains_replicator_tokens()) {
            return;
        }

        $default_key = '';
        if (is_user_logged_in()) {
            $default_key = get_user_meta(get_current_user_id(), '_replicator_api_key', true);
        }

        echo '<div class="inventkid-replicator-checkout-field" style="margin-top: 20px; padding: 16px; background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px;">';
        echo '<h3 style="margin: 0 0 8px 0; font-size: 16px; color: #166534; display: flex; align-items: center; gap: 6px;"><span>🔑</span> ' . esc_html__('Replicator Chrome Extension Key', 'inventkid-replicator') . '</h3>';
        echo '<p style="margin: 0 0 12px 0; font-size: 13px; color: #15803d;">' . esc_html__('Already using the Replicator extension? Copy your API key from the extension popup and paste it here. Your purchased tokens will be added to your existing key immediately.', 'inventkid-replicator') . '</p>';

        woocommerce_form_field('replicator_api_key', [
            'type'        => 'text',
            'class'       => ['form-row-wide'],
            'label'       => __('Existing API Key (Optional)', 'inventkid-replicator'),
            'placeholder' => 'rep_live_xxxxxxxxxxxxxxxxxxxxxxxx',
            'required'    => false,
            'default'     => $default_key,
        ], $checkout->get_value('replicator_api_key') ? $checkout->get_value('replicator_api_key') : $default_key);

        echo '</div>';
    }

    /**
     * Save API key field to order meta
     */
    public static function save_checkout_api_key_field($order_id) {
        if (!empty($_POST['replicator_api_key'])) {
            $key = sanitize_text_field($_POST['replicator_api_key']);
            update_post_meta($order_id, '_replicator_existing_api_key', $key);
        }
    }

    /**
     * Checks if current cart contains any product with token credits
     */
    private static function cart_contains_replicator_tokens() {
        if (!WC()->cart) {
            return false;
        }
        foreach (WC()->cart->get_cart() as $cart_item) {
            $product_id = !empty($cart_item['variation_id']) ? $cart_item['variation_id'] : $cart_item['product_id'];
            $tokens = absint(get_post_meta($product_id, '_replicator_tokens', true));
            if ($tokens > 0) {
                return true;
            }
        }
        return false;
    }

    public static function handle_order_completed($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        // Idempotency: avoid granting tokens twice
        if ($order->get_meta('_replicator_tokens_granted')) {
            return;
        }

        $total_tokens = 0;
        $is_free_trial = false;

        foreach ($order->get_items() as $item) {
            $product_id = $item->get_variation_id() ? $item->get_variation_id() : $item->get_product_id();
            $tokens_per_item = absint(get_post_meta($product_id, '_replicator_tokens', true));

            if ($tokens_per_item > 0) {
                $qty = $item->get_quantity();
                $total_tokens += ($tokens_per_item * $qty);

                $parent_id = wp_get_post_parent_id($product_id);
                $check_id = $parent_id ? $parent_id : $product_id;
                if (get_post_meta($check_id, '_replicator_is_free_trial', true) === 'yes') {
                    $is_free_trial = true;
                }
            }
        }

        if ($total_tokens <= 0) {
            return;
        }

        $customer_email = $order->get_billing_email();
        if (!$customer_email) {
            $order->add_order_note(__('Replicator Error: Order has no billing email.', 'inventkid-replicator'));
            return;
        }

        // Check for existing API key submitted at checkout or from user account
        $customer_user_id = $order->get_customer_id();
        $existing_key = $order->get_meta('_replicator_existing_api_key');
        if (empty($existing_key)) {
            $existing_key = get_post_meta($order_id, '_replicator_existing_api_key', true);
        }
        if (empty($existing_key) && $customer_user_id > 0) {
            $existing_key = get_user_meta($customer_user_id, '_replicator_api_key', true);
        }

        // Call Replicator Engine API
        $api_url = get_option('inventkid_replicator_api_url', 'http://localhost:3000');
        $secret  = get_option('inventkid_replicator_master_secret', 'repl_sec_dev_key_2026');

        $credit_endpoint = trailingslashit($api_url) . 'api/keys/credit';

        $payload = [
            'email'       => $customer_email,
            'tokens'      => $total_tokens,
            'orderId'     => $order_id,
            'isFreeTrial' => $is_free_trial,
        ];

        if (!empty($existing_key)) {
            $payload['apiKey'] = sanitize_text_field($existing_key);
        }

        $response = wp_remote_post($credit_endpoint, [
            'timeout' => 12,
            'headers' => [
                'Authorization' => 'Bearer ' . $secret,
                'Content-Type'  => 'application/json',
            ],
            'body'    => wp_json_encode($payload),
        ]);

        if (is_wp_error($response)) {
            $order->add_order_note(sprintf(__('Failed to credit Replicator tokens: %s', 'inventkid-replicator'), $response->get_error_message()));
            return;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body        = json_decode(wp_remote_retrieve_body($response), true);

        if ($status_code !== 200 || empty($body['success'])) {
            $err_msg = !empty($body['error']) ? $body['error'] : 'Unknown error from Replicator API';
            $order->add_order_note(sprintf(__('Replicator API error: %s', 'inventkid-replicator'), $err_msg));
            return;
        }

        $api_key = sanitize_text_field($body['apiKey']);
        $balance = absint($body['balance']);

        // Record on order
        $order->update_meta_data('_replicator_tokens_granted', $total_tokens);
        $order->update_meta_data('_replicator_api_key', $api_key);
        $order->update_meta_data('_replicator_balance', $balance);
        $order->save();

        // Record on customer user account if registered
        $customer_user_id = $order->get_customer_id();
        if ($customer_user_id > 0) {
            update_user_meta($customer_user_id, '_replicator_api_key', $api_key);
            update_user_meta($customer_user_id, '_replicator_token_balance', $balance);
            if ($is_free_trial) {
                update_user_meta($customer_user_id, '_claimed_replicator_free_trial', 'yes');
            }
        }

        $order->add_order_note(sprintf(
            __('Granted %d Replicator tokens via Engine API. License Key: %s (Total Balance: %d).', 'inventkid-replicator'),
            $total_tokens,
            $api_key,
            $balance
        ));
    }
}
