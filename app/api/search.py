# app/api/search.py
from flask import Blueprint, request, render_template
from app.services.recommender import find_books_by_query

# Blueprint này không cần tiền tố (url_prefix)
search_bp = Blueprint('search', __name__)


@search_bp.route('/search', methods=['GET'])
def search():
    """
    Route để xử lý tìm kiếm.
    Gọi từ: thanh tìm kiếm ở index.html và search.html
    """
    query = request.args.get('query', '').strip()
    
    # Nếu không có query, chỉ hiển thị trang tìm kiếm
    if not query:
        return render_template('search.html')
        
    # Gọi service để tìm kiếm
    books, error = find_books_by_query(query)
    
    if error:
        return render_template('search.html', query=query, error=error)
        
    return render_template('search.html', 
                           query=query, 
                           books=books, 
                           results_count=len(books))