# app/api/recommend.py
from flask import Blueprint, request, jsonify, render_template, redirect, url_for
from app.services.recommender import get_popular_books, get_recommendations_for_user

# Tạo một "Blueprint" (một nhóm các routes)
# 'recommend_bp' là tên để gọi, url_prefix là tiền tố cho mọi route trong file này
recommend_bp = Blueprint('recommend', __name__, url_prefix='/recommend')


@recommend_bp.route('/popular_books', methods=['GET'])
def popular_books():
    """
    API endpoint để lấy sách phổ biến (dùng cho JavaScript).
    Gọi từ: index.html, content_based.html (khi show_popular=True)
    """
    num = request.args.get('num', 9, type=int)
    books = get_popular_books(num)
    
    # Trả về dữ liệu dạng JSON
    return jsonify({'books': books})


@recommend_bp.route('/hybrid_books', methods=['POST'])
def hybrid_books():
    """
    Route để xử lý form "Đề xuất theo User ID" từ trang chủ.
    Gọi từ: index.html (khi submit form)
    """
    user_id = request.form.get('user_id', type=int)
    
    if user_id is None:
        # Xử lý nếu user_id không được nhập
        # (Dù template đã có 'required', cẩn thận không bao giờ thừa)
        return redirect(url_for('main.index')) # Quay lại trang chủ

    # Gọi service để lấy dữ liệu
    books, based_on_book, error_msg = get_recommendations_for_user(user_id)
    
    # Kịch bản 1: Có lỗi (ví dụ: user_id = 0)
    if error_msg and not "Không tìm thấy" in error_msg:
        return render_template('content_based.html', 
                               user_id=user_id, 
                               error=error_msg)

    # Kịch bản 2: Không tìm thấy user (ví dụ: user_id > 1000)
    if error_msg and "Không tìm thấy" in error_msg:
        # Render trang, báo message, và kích hoạt JS (show_popular=True)
        return render_template('content_based.html', 
                               user_id=user_id, 
                               message=error_msg, 
                               show_popular=True)
    
    # Kịch bản 3: Thành công
    return render_template('content_based.html', 
                           user_id=user_id, 
                           books=books, 
                           based_on_book=based_on_book)