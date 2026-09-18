<?php
/**
 * Strict Anti-Abuse Prevention for Free Trial Replicator Tokens
 */

if (!defined('ABSPATH')) {
    exit;
}

class InventKid_Replicator_Anti_Abuse {

    public static function init() {
        // Enforce max quantity of 1 for free trial products in cart
        add_filter('woocommerce_add_to_cart_validation', [__CLASS__, 'validate_add_to_cart'], 10, 4);
        add_filter('woocommerce_update_cart_validation', [__CLASS__, 'validate_cart_update'], 10, 4);

        // Checkout validation against duplicate free trial claims
        add_action('woocommerce_after_checkout_validation', [__CLASS__, 'validate_checkout'], 10, 2);
    }

    /**
     * Check if a product ID or variation ID is marked as a free trial product
     */
    public static function is_free_trial_product($product_id) {
        $parent_id = wp_get_post_parent_id($product_id);
        $check_id = $parent_id ? $parent_id : $product_id;
        return get_post_meta($check_id, '_replicator_is_free_trial', true) === 'yes';
    }

    /**
     * Prevent users who already claimed the trial from adding it to cart
     */
    public static function validate_add_to_cart($passed, $product_id, $quantity, $variation_id = 0) {
        $check_id = $variation_id ? $variation_id : $product_id;

        if (self::is_free_trial_product($check_id)) {
            // If user is logged in, check if already claimed
            if (is_user_logged_in()) {
                $user_id = get_current_user_id();
                if (get_user_meta($user_id, '_claimed_replicator_free_trial', true) === 'yes') {
                    wc_add_notice(__('You have already claimed your 3 free trial credits for this account.', 'inventkid-replicator'), 'error');
                    return false;
                }
            }

            // Check if cart already contains this free trial product
            foreach (WC()->cart->get_cart() as $cart_item) {
                $item_id = !empty($cart_item['variation_id']) ? $cart_item['variation_id'] : $cart_item['product_id'];
                if (self::is_free_trial_product($item_id)) {
                    wc_add_notice(__('You can only claim 1 free trial package per order.', 'inventkid-replicator'), 'error');
                    return false;
                }
            }
        }

        return $passed;
    }

    /**
     * Prevent increasing quantity of free trial product in cart
     */
    public static function validate_cart_update($passed, $cart_item_key, $values, $quantity) {
        $product_id = !empty($values['variation_id']) ? $values['variation_id'] : $values['product_id'];

        if (self::is_free_trial_product($product_id) && $quantity > 1) {
            wc_add_notice(__('Free trial packages are strictly limited to 1 per customer.', 'inventkid-replicator'), 'error');
            return false;
        }

        return $passed;
    }

    /**
     * Strict checkout validation: email and user history checks
     */
    public static function validate_checkout($data, $errors) {
        $has_free_trial = false;

        foreach (WC()->cart->get_cart() as $cart_item) {
            $product_id = !empty($cart_item['variation_id']) ? $cart_item['variation_id'] : $cart_item['product_id'];
            if (self::is_free_trial_product($product_id)) {
                $has_free_trial = true;
                break;
            }
        }

        if (!$has_free_trial) {
            return;
        }

        // 1. Check logged-in user meta
        if (is_user_logged_in()) {
            $user_id = get_current_user_id();
            if (get_user_meta($user_id, '_claimed_replicator_free_trial', true) === 'yes') {
                $errors->add('validation', __('You have already claimed your 3 free trial credits on this account.', 'inventkid-replicator'));
                return;
            }
        }

        // 2. Check billing email against past completed orders
        $billing_email = isset($data['billing_email']) ? sanitize_email($data['billing_email']) : '';
        if ($billing_email) {
            $existing_orders = wc_get_orders([
                'billing_email' => $billing_email,
                'status'        => ['completed', 'processing', 'on-hold'],
                'limit'         => 10,
            ]);

            foreach ($existing_orders as $order) {
                foreach ($order->get_items() as $item) {
                    $pid = $item->get_variation_id() ? $item->get_variation_id() : $item->get_product_id();
                    if (self::is_free_trial_product($pid)) {
                        $errors->add('validation', __('Our records show this email has already claimed the 3 free trial credits. Please log in or purchase regular tokens.', 'inventkid-replicator'));
                        return;
                    }
                }
            }
        }
    }
}
