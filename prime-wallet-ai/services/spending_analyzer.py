import re

class SpendingAnalyzer:
    def __init__(self):
        # Keyword-based categorization
        self.categories = {
            "FOOD": ["ăn", "uống", "cafe", "nhà hàng", "trưa", "tối", "phở", "food", "foody", "shopee food", "grab food"],
            "BILL": ["điện", "nước", "internet", "cáp", "mạng", "hóa đơn", "bill", "thanh toán hóa đơn", "evn", "sawaco", "vnpt", "fpt"],
            "SHOPPING": ["mua sắm", "quần áo", "shopee", "lazada", "tiki", "siêu thị", "coopmart", "vinmart"],
            "TRANSFER": ["chuyển khoản", "ck", "gửi tiền", "chuyen tien", "chuyen khoan", "ck cho"],
            "ENTERTAINMENT": ["xem phim", "cgv", "lotte", "netflix", "game", "steam", "spotify", "giải trí"],
        }

    def categorize_transaction(self, description: str) -> str:
        """
        Takes a transaction description and returns a category string.
        Returns 'OTHER' if no keyword matches.
        """
        if not description:
            return "OTHER"

        desc_lower = description.lower()
        
        for category, keywords in self.categories.items():
            for keyword in keywords:
                # Use regex to find whole word matches if possible, or simple substring match
                if keyword in desc_lower:
                    return category
                    
        return "OTHER"

    def analyze_spending(self, transactions):
        """
        Takes a list of transactions (dicts with 'amount' and 'description')
        Returns a summary dictionary: { 'CATEGORY': total_amount }
        """
        summary = {}
        for tx in transactions:
            amount = tx.get('amount', 0)
            desc = tx.get('description', '')
            
            category = self.categorize_transaction(desc)
            
            if category in summary:
                summary[category] += amount
            else:
                summary[category] = amount
                
        return summary
