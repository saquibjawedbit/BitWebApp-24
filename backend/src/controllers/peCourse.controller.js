import { PeCourse } from '../models/peCourse.model.js';
import { User } from '../models/user.model.js';
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";


export const addPeCourse = async (req, res) => {
  try {

    const { peCourseIVId, peCourseVId } = req.body;

    if (!peCourseIVId || !peCourseVId) {
      return res.status(400).json({ success: false, message: 'Missing PE course information.' });
    }

    if (peCourseIVId.toString() === peCourseVId.toString()) {
      return res.status(400).json({ success: false, message: 'Please select two different PE courses.' });
    }

    const userId = req.user._id;

    // Fetch user to get their batch and already enrolled courses
    const user = await User.findById(userId).populate('peCourses');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found!' });
    }

    // Use provided batch, otherwise default to the user's batch
    const batchToUse = user.batch ? Number(user.batch) : null;

    // Ensure student is selecting courses for their own batch
    if (Number(user.batch) !== Number(batchToUse)) {
      return res.status(400).json({ success: false, message: 'You can only select PE courses for your own batch.' });
    }

    const course1 = await PeCourse.findOne({ courseCode: peCourseIVId.toString(), batch: batchToUse });
    const course2 = await PeCourse.findOne({ courseCode: peCourseVId.toString(), batch: batchToUse });

    // console.log(course1, course2)
    // console.log(peCourseVId)


    if (!course1 || !course2) {
      return res.status(404).json({ success: false, message: 'PE Course not found for the specified batch!' });
    }

    console.log('User PE Courses:', user.peCourses);

    console.log(course1.branch)
    if (user.branch !== course1.branch || user.branch !== course2.branch) {
      return res.status(400).json({ success: false, message: 'You cannot select a PE course from a different branch.' });
    }

    // Added Section for 
    const validSections = ['A', 'B', 'C', 'D'];
    if (!validSections.includes(user.section)) {
      return res.status(400).json({ success: false, message: 'You are not eligible to select a PE course from your section.' });
    }

    const isStudentAlreadyEnrolled = user.peCourses.some(enrolledCourse => 
      enrolledCourse.toString() === course1._id.toString() ||
      enrolledCourse.toString() === course2._id.toString()
    );

    console.log("Student Enrolled? ", isStudentAlreadyEnrolled);
    
    if (isStudentAlreadyEnrolled) {
      return res.status(400).json({ success: false, message: 'You have already selected a PE course.' });
    }

    course1.students.push(userId);
    course2.students.push(userId);

    // console.log("User", user);
    
    await course1.save();
    await course2.save();

    await User.findByIdAndUpdate(userId, {
      $push: { peCourses: { $each: [course1._id, course2._id] } },
    });

    const updatedUser = await User.findById(userId).populate('peCourses');
    console.log('Updated User PE Courses:', updatedUser.peCourses);

    res.status(200).json({ success: true, message: 'PE course added successfully.' });
  } catch (error) {
    console.error('Error in addPeCourse:', error);
    res.status(500).json({ success: false, message: 'Server error, try again later.' });
  }
};

export const getAdminPeCourses = asyncHandler(async (req, res) => {
  try {
    const { batch } = req.query;
    const query = { peCourses: { $exists: true, $ne: [] } }; // Only users with PE courses
    if (batch) query.batch = Number(batch);

    // Fetch users who have enrolled in PE courses
    const users = await User.find(query)
      .populate('peCourses')
      .select('fullName rollNumber branch section batch peCourses');

    if (!users || users.length === 0) {
      return res.status(200).json(new ApiResponse(200, [], 'No students have selected PE courses yet.'));
    }

    // Transform the data to match the frontend's expected structure
    const transformedData = [];
    
    users.forEach(user => {
      if (user.peCourses && user.peCourses.length > 0) {
        user.peCourses.forEach(course => {
          transformedData.push({
            courseCode: course.courseCode,
            courseName: course.courseName,
            type: course.type,
            batch: course.batch,
            branch: course.branch,
            students: [{
              fullName: user.fullName,
              rollNumber: user.rollNumber,
              branch: user.branch,
              section: user.section,
              batch: user.batch
            }]
          });
        });
      }
    });

    // Group by courseCode to aggregate students
    const coursesMap = {};
    transformedData.forEach(item => {
      const key = `${item.courseCode}-${item.type}`;
      if (!coursesMap[key]) {
        coursesMap[key] = {
          courseCode: item.courseCode,
          courseName: item.courseName,
          type: item.type,
          batch: item.batch,
          branch: item.branch,
          students: []
        };
      }
      coursesMap[key].students.push(...item.students);
    });

    const courses = Object.values(coursesMap);

    return res.status(200).json(
      new ApiResponse(200, courses, 'All PE course data with students fetched successfully.')
    );
  } catch (error) {
    console.error('Error fetching PE courses:', error);
    return res.status(500).json(
      new ApiResponse(500, null, 'An error occurred while fetching PE courses.')
    );
  }
});


export const getUserPeCourses = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId).populate('peCourses');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found!' });
    }
    
    res.status(200).json({ success: true, data: user.peCourses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error, try again later.' });
  }
};