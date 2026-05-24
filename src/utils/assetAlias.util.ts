/**
 * Map of common crypto asset aliases (lowercase) to their canonical ticker symbol.
 * Extensible — add new aliases as needed.
 */
const ASSET_ALIASES: Record<string, string> = {
    bitcoin: 'BTC',
    btc: 'BTC',
    ethereum: 'ETH',
    eth: 'ETH',
    solana: 'SOL',
    sol: 'SOL',
    tether: 'USDT',
    usdt: 'USDT',
    polygon: 'MATIC',
    matic: 'MATIC',
    chainlink: 'LINK',
    link: 'LINK',
};

/**
 * Normalize an asset name/alias to its canonical uppercase ticker symbol.
 * Case-insensitive lookup. If no alias is found, returns the input uppercased.
 *
 * @example normalizeAsset('bitcoin') => 'BTC'
 * @example normalizeAsset('ETH')     => 'ETH'
 * @example normalizeAsset('DOGE')    => 'DOGE'  (unknown — passthrough)
 */
export function normalizeAsset(asset: string): string {
    if (!asset) return '';

    const key = asset.trim().toLowerCase();
    return ASSET_ALIASES[key] || asset.trim().toUpperCase();
}
