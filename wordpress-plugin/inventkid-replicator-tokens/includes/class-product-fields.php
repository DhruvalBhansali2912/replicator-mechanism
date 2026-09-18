<?php
/**
 * Product Custom Meta Fields for Replicator Tokens
 */

if (!defined('ABSPATH')) {
    exit;
}

class InventKid_Replicator_Product_Fields {

    public static function init() {
        // Simple product fields
        add_action('woocommerce_product_options_general_product_data', [__CLASS__, 'add_simple_product_fields']);
        add_action('woocommerce_process_product_meta', [__CLASS__, 'save_simple_product_fields']);

        // Variable product fields
        add_action('woocommerce_product_after_variable_attributes', [__CLASS__, 'add_variation_fields'], 10, 3);
        add_action('woocommerce_save_product_variation', [__CLASS__, 'save_variation_fields'], 10, 2);

        // Product list column
        add_filter('manage_edit-product_columns', [__CLASS__, 'add_product_column']);
        add_action('manage_product_posts_custom_column', [__CLASS__, 'render_product_column'], 10, 2);
    }

    /**
     * Add token fields to standard product edit page (General Tab)
     */
    public static function add_simple_product_fields() {
        echo '<div class="options_group show_if_simple">';

        woocommerce_wp_text_input([
            'id'                => '_replicator_tokens',
            'label'             => __('Replicator Tokens', 'inventkid-replicator'),
            'placeholder'       => '0',
            'desc_tip'          => true,
            'description'       => __('Enter the number of page replication tokens granted on purchase. Leave 0 or blank for regular products.', 'inventkid-replicator'),
            'type'              => 'number',
            'custom_attributes' => [
                'step' => '1',
                'min'  => '0',
            ],
        ]);

        woocommerce_wp_checkbox([
            'id'          => '_replicator_is_free_trial',
            'label'       => __('Free Trial Product?', 'inventkid-replicator'),
            'description' => __('Check this if this product is a 1-time free trial (enforces strict anti-abuse: max 1 per user/device).', 'inventkid-replicator'),
        ]);

        echo '</div>';
    }

    /**
     * Save simple product fields
     */
    public static function save_simple_product_fields($post_id) {
        $tokens = isset($_POST['_replicator_tokens']) ? sanitize_text_field($_POST['_replicator_tokens']) : '';
        if ($tokens !== '') {
            update_post_meta($post_id, '_replicator_tokens', absint($tokens));
        } else {
            delete_post_meta($post_id, '_replicator_tokens');
        }

        $is_free = isset($_POST['_replicator_is_free_trial']) ? 'yes' : 'no';
        update_post_meta($post_id, '_replicator_is_free_trial', $is_free);
    }

    /**
     * Add variation token fields
     */
    public static function add_variation_fields($loop, $variation_data, $variation) {
        woocommerce_wp_text_input([
            'id'                => "_variable_replicator_tokens[{$loop}]",
            'label'             => __('Replicator Tokens', 'inventkid-replicator'),
            'placeholder'       => '0',
            'desc_tip'          => true,
            'description'       => __('Number of tokens granted for this variation.', 'inventkid-replicator'),
            'value'             => get_post_meta($variation->ID, '_replicator_tokens', true),
            'type'              => 'number',
            'custom_attributes' => [
                'step' => '1',
                'min'  => '0',
            ],
        ]);
    }

    /**
     * Save variation token fields
     */
    public static function save_variation_fields($variation_id, $i) {
        if (isset($_POST['_variable_replicator_tokens'][$i])) {
            $tokens = sanitize_text_field($_POST['_variable_replicator_tokens'][$i]);
            if ($tokens !== '') {
                update_post_meta($variation_id, '_replicator_tokens', absint($tokens));
            } else {
                delete_post_meta($variation_id, '_replicator_tokens');
            }
        }
    }

    /**
     * Add Tokens column to admin products table
     */
    public static function add_product_column($columns) {
        $columns['replicator_tokens'] = __('Tokens', 'inventkid-replicator');
        return $columns;
    }

    /**
     * Render column content
     */
    public static function render_product_column($column, $post_id) {
        if ($column === 'replicator_tokens') {
            $tokens = get_post_meta($post_id, '_replicator_tokens', true);
            $is_free = get_post_meta($post_id, '_replicator_is_free_trial', true) === 'yes';

            if (!empty($tokens)) {
                echo '<strong>' . esc_html($tokens) . ' tokens</strong>';
                if ($is_free) {
                    echo ' <span class="badge" style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:3px; font-size:11px;">Free Trial</span>';
                }
            } else {
                echo '<span style="color:#999;">—</span>';
            }
        }
    }
}
