package com.spagenio.travel.model;
import java.util.ArrayList;
import java.util.List;
public class TravelDatabase {
    private List<User> users = new ArrayList<>();
    private List<Post> posts = new ArrayList<>();
    private List<Plan> plans = new ArrayList<>();
    public List<User> getUsers() { return users; } public void setUsers(List<User> v) { this.users = v; }
    public List<Post> getPosts() { return posts; } public void setPosts(List<Post> v) { this.posts = v; }
    public List<Plan> getPlans() { return plans; } public void setPlans(List<Plan> v) { this.plans = v; }
}
