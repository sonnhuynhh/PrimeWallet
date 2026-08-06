import pandas as pd
from sklearn.ensemble import IsolationForest

class FraudDetector:
    def __init__(self):
        # Isolation Forest is an unsupervised anomaly detection algorithm
        # contamination = 0.05 implies we expect 5% of our data to be fraudulent/anomalous
        self.model = IsolationForest(contamination=0.05, random_state=42)
        self.is_trained = False

    def train(self, transactions):
        """
        Train the model using a list of transactions.
        Features extracted:
        - amount: the transaction amount
        - time_diff_minutes: time difference from previous transaction (to detect rapid consecutive transfers)
        """
        if not transactions or len(transactions) < 10:
            # Need a minimum number of transactions to train effectively
            return False

        df = pd.DataFrame(transactions)
        
        # Sort by time to calculate time differences
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values(by='timestamp')

        # Feature Engineering
        df['time_diff_minutes'] = df['timestamp'].diff().dt.total_seconds().fillna(3600) / 60.0
        
        # We only use 'amount' and 'time_diff_minutes' for anomaly detection
        features = df[['amount', 'time_diff_minutes']]
        
        self.model.fit(features)
        self.is_trained = True
        return True

    def detect_fraud(self, recent_transactions):
        """
        Detect if recent behavior is fraudulent.
        Returns a list of booleans: True if fraudulent (anomaly), False otherwise.
        """
        if not self.is_trained:
            # Fallback to simple rule-based if model is not trained
            results = []
            for tx in recent_transactions:
                is_large_amount = tx['amount'] > 50000000 # 50 million VND
                results.append(is_large_amount)
            return results

        df = pd.DataFrame(recent_transactions)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values(by='timestamp')

        # Assume these are sequential to some past, or calculate relative to each other
        df['time_diff_minutes'] = df['timestamp'].diff().dt.total_seconds().fillna(0) / 60.0
        
        features = df[['amount', 'time_diff_minutes']]
        
        # predict returns -1 for outliers and 1 for inliers
        predictions = self.model.predict(features)
        
        # Convert to boolean: True if Fraud (-1)
        is_fraud = [pred == -1 for pred in predictions]
        
        return is_fraud
