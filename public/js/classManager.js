import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

function getClassDocRef(db, teacherId) {
    if (!db) throw new Error('Firestore 인스턴스가 필요합니다.');
    if (!teacherId) throw new Error('교사 ID가 필요합니다.');
    return doc(db, 'classes', teacherId);
}

export async function fetchTeacherClass(db, teacherId) {
    const classRef = getClassDocRef(db, teacherId);
    const snapshot = await getDoc(classRef);
    if (!snapshot.exists()) {
        return null;
    }
    const data = snapshot.data() || {};
    const students = Array.isArray(data.students) ? data.students : [];
    return {
        id: classRef.id,
        name: data.name || '',
        students
    };
}

export async function createTeacherClass(db, teacherId, className) {
    if (!className) {
        throw new Error('학급 이름이 필요합니다.');
    }
    const classRef = getClassDocRef(db, teacherId);
    const existing = await getDoc(classRef);
    if (existing.exists()) {
        await updateDoc(classRef, { name: className });
    } else {
        await setDoc(classRef, { name: className, students: [] });
    }
    return classRef.id;
}

export async function addStudentsToTeacherClass(db, teacherId, studentIds) {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return;
    }
    const classRef = getClassDocRef(db, teacherId);
    await updateDoc(classRef, { students: arrayUnion(...studentIds) });
}

export async function updateTeacherClassStudents(db, teacherId, students) {
    if (!Array.isArray(students)) {
        throw new Error('학생 목록은 배열이어야 합니다.');
    }
    const classRef = getClassDocRef(db, teacherId);
    await updateDoc(classRef, { students });
}
