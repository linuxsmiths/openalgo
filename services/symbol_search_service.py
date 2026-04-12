"""
Symbol Search Service
Searches for symbols across all brokers' master contracts
"""


def search_symbols(query: str, exchange: str = None, limit: int = 20, master_contract_df=None) -> list:
    """
    Search for symbols by name or company name
    Flexible search across master contract
    
    Args:
        query: Search term (symbol or company name)
        exchange: Filter by exchange (NSE, BSE, NFO) - optional
        limit: Max results to return (default: 20)
        master_contract_df: DataFrame with master contract (if None, returns empty list)
    
    Returns:
        list of dicts with symbol, exchange, and company_name
    """
    try:
        # If no master contract provided, return empty list
        if master_contract_df is None or master_contract_df.empty:
            return []
        
        master_contract = master_contract_df
        
        # Convert query to uppercase for case-insensitive search
        query_upper = query.upper()
        
        # Filter by symbol or company name
        if exchange:
            filtered = master_contract[
                (master_contract['exchange'].str.upper() == exchange.upper()) &
                (
                    (master_contract['symbol'].str.contains(query_upper, case=False, na=False)) |
                    (master_contract['name'].str.contains(query_upper, case=False, na=False))
                )
            ]
        else:
            filtered = master_contract[
                (master_contract['symbol'].str.contains(query_upper, case=False, na=False)) |
                (master_contract['name'].str.contains(query_upper, case=False, na=False))
            ]
        
        # Remove duplicates (keep first occurrence)
        filtered = filtered.drop_duplicates(subset=['symbol', 'exchange'], keep='first')
        
        # Limit results
        filtered = filtered.head(limit)
        
        # Format results
        results = []
        for _, row in filtered.iterrows():
            results.append({
                'symbol': row.get('symbol', ''),
                'exchange': row.get('exchange', 'NSE'),
                'name': row.get('name', ''),
                'company_name': row.get('company_name', row.get('name', '')),
            })
        
        return results
    
    except Exception as e:
        print(f"Error searching symbols: {e}")
        return []


def get_symbol_info(symbol: str, exchange: str = 'NSE', master_contract_df=None) -> dict:
    """
    Get detailed info for a specific symbol
    
    Args:
        symbol: Trading symbol
        exchange: Exchange type (default: NSE)
        master_contract_df: DataFrame with master contract (if None, returns empty dict)
    
    Returns:
        dict with symbol info or empty dict if not found
    """
    try:
        # If no master contract provided, return empty dict
        if master_contract_df is None or master_contract_df.empty:
            return {}
        
        master_contract = master_contract_df
        
        # Search for exact symbol match
        match = master_contract[
            (master_contract['symbol'].str.upper() == symbol.upper()) &
            (master_contract['exchange'].str.upper() == exchange.upper())
        ].iloc[0] if not master_contract[
            (master_contract['symbol'].str.upper() == symbol.upper()) &
            (master_contract['exchange'].str.upper() == exchange.upper())
        ].empty else None
        
        if match is None:
            return {}
        
        return {
            'symbol': match.get('symbol', ''),
            'exchange': match.get('exchange', 'NSE'),
            'name': match.get('name', ''),
            'company_name': match.get('company_name', match.get('name', '')),
            'isin': match.get('isin', ''),
            'token': match.get('token', ''),
        }
    
    except Exception as e:
        print(f"Error getting symbol info: {e}")
        return {}


def validate_symbol(symbol: str, exchange: str = 'NSE', master_contract_df=None) -> bool:
    """
    Check if a symbol exists in master contract
    
    Args:
        symbol: Trading symbol
        exchange: Exchange type
        master_contract_df: DataFrame with master contract (optional)
    
    Returns:
        bool - True if symbol exists
    """
    return len(get_symbol_info(symbol, exchange, master_contract_df)) > 0


def get_popular_symbols(exchange: str = 'NSE', limit: int = 50, master_contract_df=None) -> list:
    """
    Get popular/liquid symbols for quick access
    
    Args:
        exchange: Exchange type (default: NSE)
        limit: Max symbols to return
        master_contract_df: DataFrame with master contract (optional)
    
    Returns:
        list of dicts with symbol and name
    """
    try:
        # If no master contract provided, return empty list
        if master_contract_df is None or master_contract_df.empty:
            return []
        
        master_contract = master_contract_df
        if not master_contract or master_contract.empty:
            return []
        
        # Filter by exchange and sort by volume or popularity
        filtered = master_contract[
            master_contract['exchange'].str.upper() == exchange.upper()
        ]
        
        # If volume column exists, sort by it (descending)
        if 'volume' in filtered.columns:
            filtered = filtered.sort_values('volume', ascending=False)
        
        filtered = filtered.head(limit)
        
        # Format results
        results = []
        for _, row in filtered.iterrows():
            results.append({
                'symbol': row.get('symbol', ''),
                'exchange': row.get('exchange', 'NSE'),
                'name': row.get('name', ''),
            })
        
        return results
    
    except Exception as e:
        print(f"Error getting popular symbols: {e}")
        return []
