"""
SpendingAnalyzer — Phân loại chi tiêu và sinh insights cho user.

Cải tiến so với bản cũ:
1. Nhiều category hơn (Ăn uống, Hóa đơn, Mua sắm, Giải trí, Y tế, Giáo dục, Crypto, Chuyển khoản, Khác)
2. Phân loại thông minh hơn với từ khóa tiếng Việt mở rộng
3. Sinh insights tiếng Việt có ý nghĩa (top chi tiêu, thay đổi theo thời gian)
4. Tổng hợp theo tuần/tháng
"""
from collections import defaultdict


class SpendingAnalyzer:
    def __init__(self):
        self.categories = {
            "FOOD": ["ăn", "uống", "cafe", "nhà hàng", "trưa", "tối", "phở", "food", "foody",
                     "shopee food", "grab food", "ăn sáng", "ăn trưa", "ăn tối", "coffee",
                     "trà sữa", "lẩu", "mì", "cơm"],
            "BILL": ["điện", "nước", "internet", "cáp", "mạng", "hóa đơn", "bill",
                     "thanh toán hóa đơn", "evn", "sawaco", "vnpt", "fpt", "điện lực",
                     "tiền điện", "tiền nước", "wifi"],
            "SHOPPING": ["mua sắm", "quần áo", "shopee", "lazada", "tiki", "siêu thị",
                         "coopmart", "vinmart", "giày", "điện thoại", "laptop", "sách"],
            "TRANSFER": ["chuyển khoản", "ck", "gửi tiền", "chuyen tien", "chuyen khoan",
                         "ck cho", "chuyển tiền", "tặng", "cho mượn"],
            "ENTERTAINMENT": ["xem phim", "cgv", "lotte", "netflix", "game", "steam",
                              "spotify", "giải trí", "karaoke", "concert", "phim"],
            "TRANSPORT": ["grab", "xe ôm", "taxi", "xăng", "be", "bus", "tàu", "vé máy bay",
                          "xedap", "grabcar", "grab bike"],
            "HEALTH": ["bệnh viện", "thuốc", "khám", "nhà thuốc", "bác sĩ", "sức khỏe",
                       "vitamin", "tập gym"],
            "EDUCATION": ["học phí", "khóa học", "lớp học", "trường", "đại học", "sách giáo",
                          "gia sư", "tiếng anh"],
            "CRYPTO": ["eth", "usdt", "usdc", "bnb", "polygon", "matic", "bitcoin", "btc",
                       "swap", "defi", "uniswap", "pancake", "ví web3", "crypto"],
            "INCOME": ["lương", "thưởng", "lãi", "hoàn tiền", "cashback", "refund", "nhận",
                       "income", "salary"],
        }

    @staticmethod
    def _tx_type(tx: dict) -> str:
        """Lấy loại giao dịch — SQLite trả key snake_case, Kafka event trả camelCase."""
        return tx.get("transactionType") or tx.get("transaction_type") or ""

    def categorize_transaction(self, description: str) -> str:
        if not description:
            return "OTHER"
        desc_lower = description.lower()
        for category, keywords in self.categories.items():
            for keyword in keywords:
                if keyword in desc_lower:
                    return category
        return "OTHER"

    def analyze_spending(self, transactions) -> dict:
        """
        Phân loại toàn bộ giao dịch → summary theo category.
        Chỉ tính chi tiêu (amount âm / loại chi) trừ INCOME.
        """
        summary = defaultdict(float)
        count = defaultdict(int)
        for tx in transactions:
            amount = float(tx.get("amount") or 0)
            # Chỉ tính tiền CHI RA (âm trong DB nếu là debit, dương cho topup/income)
            is_income = self.categorize_transaction(tx.get("description", "")) == "INCOME"
            tx_type = self._tx_type(tx)
            is_outflow = tx_type in ("WITHDRAW", "TRANSFER", "PAYMENT", "CRYPTO_SEND")
            if is_outflow:
                category = self.categorize_transaction(tx.get("description", ""))
                summary[category] += abs(amount)
                count[category] += 1
            elif is_income and tx_type in ("TOPUP", "INCOME"):
                category = "INCOME"
                summary[category] += abs(amount)
                count[category] += 1

        # Chuyển defaultdict → dict thường
        return {
            "by_category": dict(summary),
            "counts": dict(count),
        }

    def insights(self, user_id: str, transactions) -> dict:
        """
        Sinh insights tiếng Việt có ý nghĩa cho user.
        """
        if not transactions:
            return {
                "user_id": user_id,
                "has_data": False,
                "message": "Chưa có đủ dữ liệu giao dịch để phân tích.",
                "insights": [],
            }

        analysis = self.analyze_spending(transactions)
        by_category = analysis["by_category"]
        insights_list = []

        # 1. Top category chi tiêu
        spend_cats = {k: v for k, v in by_category.items() if k != "INCOME"}
        if spend_cats:
            top_cat = max(spend_cats, key=spend_cats.get)
            cat_labels = {
                "FOOD": "Ăn uống", "BILL": "Hóa đơn", "SHOPPING": "Mua sắm",
                "TRANSFER": "Chuyển khoản", "ENTERTAINMENT": "Giải trí",
                "TRANSPORT": "Đi lại", "HEALTH": "Y tế", "EDUCATION": "Giáo dục",
                "CRYPTO": "Crypto", "OTHER": "Khác",
            }
            insights_list.append({
                "type": "top_category",
                "icon": "🔥",
                "title": f"Chi tiêu nhiều nhất: {cat_labels.get(top_cat, top_cat)}",
                "detail": f"Bạn đã chi {spend_cats[top_cat]:,.0f} VND "
                          f"({len(by_category)} danh mục) trong giai đoạn này.",
            })

        # 2. Tổng chi tiêu
        total_spend = sum(spend_cats.values())
        total_income = by_category.get("INCOME", 0)
        if total_spend > 0:
            insights_list.append({
                "type": "total_spend",
                "icon": "💸",
                "title": f"Tổng chi tiêu: {total_spend:,.0f} VND",
                "detail": f"Có {analysis['counts'].get('INCOME', 0)} khoản thu nhập "
                          f"({total_income:,.0f} VND) trong cùng giai đoạn.",
            })

        # 3. Số giao dịch
        tx_count = len(transactions)
        insights_list.append({
            "type": "tx_count",
            "icon": "📊",
            "title": f"{tx_count} giao dịch trong hệ thống",
            "detail": f"{analysis['counts'].get('INCOME', 0)} khoản thu, "
                      f"{sum(c for c in analysis['counts'].values()) - analysis['counts'].get('INCOME', 0)} khoản chi.",
        })

        # 4. Giao dịch lớn nhất
        max_tx = max(transactions, key=lambda t: abs(float(t.get("amount") or 0)))
        max_amount = abs(float(max_tx.get("amount") or 0))
        if max_amount > 0:
            insights_list.append({
                "type": "largest_tx",
                "icon": "💎",
                "title": f"Giao dịch lớn nhất: {max_amount:,.0f} VND",
                "detail": (max_tx.get("description") or "Không có mô tả")[:80],
            })

        return {
            "user_id": user_id,
            "has_data": True,
            "summary": analysis["by_category"],
            "insights": insights_list,
        }
