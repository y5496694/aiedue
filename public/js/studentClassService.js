import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

function validateInputs(db, studentId) {
    if (!db) {
        throw new Error('Firestore 인스턴스가 필요합니다.');
    }
    const trimmedId = (studentId || '').trim();
    if (!trimmedId) {
        throw new Error('학생 ID가 필요합니다.');
    }
    return trimmedId;
}

function mapClassDocument(docSnapshot) {
    const data = docSnapshot.data() || {};
    const students = Array.isArray(data.students) ? data.students : [];
    const teacherId = data.teacherId || docSnapshot.id;
    return {
        id: docSnapshot.id,
        name: data.name || '내 학급',
        teacherId,
        students,
        createdAt: data.createdAt || null,
    };
}

export async function fetchClassesForStudent(db, studentId) {
    const validStudentId = validateInputs(db, studentId);
    try {
        const classesCollection = collection(db, 'classes');
        const classesQuery = query(classesCollection, where('students', 'array-contains', validStudentId));
        const snapshot = await getDocs(classesQuery);
        if (snapshot.empty) {
            return [];
        }
        return snapshot.docs.map(mapClassDocument);
    } catch (error) {
        console.error('학생 학급 정보를 불러오는 중 오류가 발생했습니다:', error);
        throw error;
    }
}
