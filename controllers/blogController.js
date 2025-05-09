import { marked } from 'marked';
import moment from 'moment';
import slugify from 'slugify';

import { blogModel } from '../models/Blog.js';
import { openai } from '../config/openai.js';
import { getRandomTopic } from './topicController.js';
import {
	getRandomUser,
	getUser,
	getUserBySlug,
	getUsers,
} from '../services/userService.js';
import * as blogService from '../services/blogService.js';
import * as makeService from '../services/makeService.js';

export const generateBlog = async () => {
	try {
		const topic = await getRandomTopic();
		const author = await getRandomUser();

		const response = await openai.chat.completions.create({
			model: 'gpt-4.1-nano',
			messages: [
				{
					role: 'system',
					content: `You are a tech blog writer named ${
						author.name
					}. Your writing style is ${
						author.writingStyle
					}. Your personality traits are ${author.personalityTraits.join(
						', '
					)}. And you are an expert in areas like ${author.areasOfExpertise.join(
						', '
					)}.`,
				},
				{
					role: 'user',
					content: `
                Write a blog about a topic in technology related to ${topic.title}.
                
                The response should be a json object with title and content, categories and summary properties.
                The title should be a catchy title.
                The content should be a well-structured blog post with headings and subheadings.
                The blog should be informative and engaging.
                The blog should be around 500 words.
                The response should contain an array of categories that the blog belongs to.
                The summary should be in not more than 50 words.
            `,
				},
			],
		});

		const content = response.choices[0].message.content;
		const parsedContent = JSON.parse(content);

		const newBlog = new blogModel({
			title: parsedContent.title,
			content: parsedContent.content,
			createdAt: new Date(),
			slug: await getSlug(parsedContent.title.toLowerCase()),
			categories: parsedContent.categories,
			summary: parsedContent.summary,
			userId: author._id,
		});

		const blog = await newBlog.save();

		// post to linkedin
		await makeService.postBlogToLinkedIn(
			blog.title,
			blog.categories,
			blog.summary,
			blog.slug
		);

		// post to linkedin
	} catch (err) {
		console.error('❌ Error generating blog:', err);
	}
};

export const getAllBlogs = async (req, res) => {
	const blogs = await blogModel.find({}).sort({ createdAt: -1 });

	const parsedBlogs = blogs.map((blog) => {
		return {
			...blog._doc,
			content: marked.parse(blog.content),
			date: moment(blog.createdAt).format('MMM DD, YYYY hh:mm A'),
		};
	});

	const categories = await blogService.getAllCategories();
	const users = await getUsers();

	res.render('blogs', { blogs: parsedBlogs, categories, users });
};

export const getBlog = async (req, res) => {
	try {
		const slug = req.params.slug;
		const blog = await blogModel.findOne({ slug: slug });

		if (!blog) {
			throw Error('Blog not found');
		}

		const title = blog.title;
		const content = marked.parse(blog.content);
		const date = moment(blog.createdAt).format('MMM DD, YYYY hh:mm A');
		const categories = blog.categories;
		const summary = blog.summary;
		const views = blog.views || 0;
		let user = {};

		if (blog?.userId) {
			user = await getUser(blog.userId);
		}

		// Update view count
		await updateViews(slug);

		res.render('blog', {
			blog: { title, content, date, categories, summary, views, user },
		});
	} catch (err) {
		console.error('❌ Error fetching blog:', err);
		res.status(404).render('404', { title: 'Blog Not Found' });
	}
};

export const getBlogsByCategory = async (req, res) => {
	try {
		const category = req.params.category;
		const blogs = await blogModel
			.find({ categories: { $regex: new RegExp(`^${category}$`, 'i') } })
			.sort({ createdAt: -1 });

		if (blogs.length === 0) {
			throw Error('No blogs found for this category');
		}

		const parsedBlogs = blogs.map((blog) => {
			return {
				...blog._doc,
				summary: blog.summary,
				date: moment(blog.createdAt).format('MMM DD, YYYY hh:mm A'),
			};
		});

		const categories = await blogService.getAllCategories();
		const users = await getUsers();

		res.render('blogs', { blogs: parsedBlogs, categories, users });
	} catch (err) {
		console.error('❌ Error fetching blogs by category:', err);
		res.status(404).render('404', { title: 'Category Not Found' });
	}
};

const getSlug = async (title) => {
	let slug = slugify(title);
	let counter = 1;

	while (await blogModel.exists({ slug })) {
		slug = `${slug}-${counter++}`;
	}

	return slug;
};

const updateViews = async (slug) => {
	return blogModel.updateOne({ slug: slug }, { $inc: { views: 1 } });
};

export const genBlog = async (req, res) => {
	await generateBlog();
	res.json({ message: 'Gnerated' });
};

export const getBlogsByUser = async (req, res) => {
	try {
		const userSlug = req.params.userSlug;
		const user = await getUserBySlug(userSlug);

		const blogs = await blogModel
			.find({ userId: user.id })
			.sort({ createdAt: -1 });

		if (blogs.length === 0) {
			throw Error('No blogs found for this category');
		}

		const parsedBlogs = blogs.map((blog) => {
			return {
				...blog._doc,
				summary: blog.summary,
				date: moment(blog.createdAt).format('MMM DD, YYYY hh:mm A'),
			};
		});

		const categories = await blogService.getAllCategories();
		const users = await getUsers();

		res.render('blogs', { blogs: parsedBlogs, categories, users });
	} catch (err) {
		console.error('❌ Error fetching blogs by category:', err);
		res.status(404).render('404', { title: 'Category Not Found' });
	}
};
