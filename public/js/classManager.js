import {
    addDoc,
    arrayUnion,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const ensureDb = (db) => {
    if (!db) throw new Error('Firestore 인스턴스가 필요합니다.');
};

const ensureTeacherId = (teacherId) => {
    if (!teacherId) throw new Error('교사 ID가 필요합니다.');
};

const classesCollection = (db) => collection(db, 'classes');

const legacyClassRef = (db, teacherId) => doc(db, 'classes', teacherId);

export async function fetchTeacherClasses(db, teacherId) {
    ensureDb(db);
    ensureTeacherId(teacherId);

    const result = [];
    const q = query(classesCollection(db), where('teacherId', '==', teacherId));
    const snap = await getDocs(q);

    snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        result.push({
            id: docSnap.id,
            name: data.name || '',
            teacherId: data.teacherId || teacherId,
            students: Array.isArray(data.students) ? data.students : [],
            createdAt: data.createdAt || null,
        });
    });

    const legacyRef = legacyClassRef(db, teacherId);
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
        const legacyData = legacySnap.data() || {};
        const legacyTeacherId = legacyData.teacherId || teacherId;
        if (!legacyData.teacherId) {
            try {
                await updateDoc(legacyRef, { teacherId: legacyTeacherId });
            } catch (error) {
                console.warn('학급 문서 teacherId 업데이트 실패:', error);
            }
        }
        if (!result.some((cls) => cls.id === legacyRef.id)) {
            result.push({
                id: legacyRef.id,
                name: legacyData.name || '',
                teacherId: legacyTeacherId,
                students: Array.isArray(legacyData.students) ? legacyData.students : [],
                createdAt: legacyData.createdAt || null,
            });
        }
    }

    result.sort((a, b) => {
        const aTime = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : 0;
        const bTime = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : 0;
        if (aTime !== bTime) {
            return aTime - bTime;
        }
        return (a.name || '').localeCompare(b.name || '', 'ko');
    });

    return result;
}

export async function createTeacherClass(db, teacherId, className) {
    ensureDb(db);
    ensureTeacherId(teacherId);
    if (!className) {
        throw new Error('학급 이름이 필요합니다.');
    }

    const newDoc = await addDoc(classesCollection(db), {
        teacherId,
        name: className,
        students: [],
        createdAt: serverTimestamp(),
    });

    return newDoc.id;
}

export async function addStudentsToClass(db, classId, studentIds) {
    ensureDb(db);
    if (!classId) throw new Error('학급 ID가 필요합니다.');
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return;
    }
    const classRef = doc(db, 'classes', classId);
    await updateDoc(classRef, { students: arrayUnion(...studentIds) });
}

export async function updateClassStudents(db, classId, students) {
    ensureDb(db);
    if (!classId) throw new Error('학급 ID가 필요합니다.');
    if (!Array.isArray(students)) {
        throw new Error('학생 목록은 배열이어야 합니다.');
    }
    const classRef = doc(db, 'classes', classId);
    await updateDoc(classRef, { students });
}

export async function fetchClassesForStudent(db, studentId) {
    ensureDb(db);
    if (!studentId) throw new Error('학생 ID가 필요합니다.');

    const q = query(classesCollection(db), where('students', 'array-contains', studentId));
    const snap = await getDocs(q);
    const classes = [];
    snap.forEach((docSnap) => {
        const data = docSnap.data() || {};
        classes.push({
            id: docSnap.id,
            name: data.name || '',
            teacherId: data.teacherId || '',
            students: Array.isArray(data.students) ? data.students : [],
            createdAt: data.createdAt || null,
        });
    });
    return classes;
}
