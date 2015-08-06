#include <iostream>
#include <glob.h>
#include <string>
#include <vector>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <math.h>
#include <vector>


std::string getLastFile(const std::string& dir, const std::string& suffix );
int watch_directory_for_new(const std::string& dir, const std::string& suffix, double heartbeat_secs);
void report(const std::string& filename);

void getFileList(const std::string& dir, const std::string& suffix, std::vector<std::string>& out)
{
  glob_t globbuf;
  globbuf.gl_offs = 0;
  std::string globstr = dir + "*" + suffix;
  glob( globstr.c_str(),
        0, // flags
        NULL, //errfunc
        &globbuf);
        
  std::string first = globbuf.gl_pathv[0];
  for(size_t i = 0; i< globbuf.gl_pathc; i++) {
    out.push_back(globbuf.gl_pathv[i]);
  }
  globfree(&globbuf);
}

std::string getLastFile(const std::string& dir, const std::string& suffix )
{
  std::vector<std::string> glob;
  getFileList(dir,suffix,glob);
  return (glob.back());
}

/////////////////////////////////////////////////////////////////////////
// Linux version: use inotify.
#ifdef __linux__
#include <sys/inotify.h>

int watch_directory_for_new(const std::string& dir, const std::string& suffix, double heartbeat_secs)
{
  using namespace std;
  int inotifyFd = inotify_init1( IN_NONBLOCK); 
  if (inotifyFd == -1) {
      std::cerr << "Error. inotify_init()" << endl;
      return 1;
    }
  
  int wd = inotify_add_watch(inotifyFd, dir.c_str(),  IN_MOVED_TO|IN_CREATE);
  if (wd == -1) {
      std::cerr << "Error. inotify_init()" << endl;
      return 1;
    }
  
  struct inotify_event* event;
  const size_t kBuffSize = 1024;
  char buffer[kBuffSize];
  
  while(1) {
    
    // Block until there is some data to read. do heartbeats until true.
    fd_set set;
    struct timeval timeout;
    int rv = 0;
    while(rv == 0) {
      timeout.tv_sec = floor(heartbeat_secs);
      timeout.tv_usec = fmod(heartbeat_secs,1.0)*1000000;
      FD_ZERO(&set); /* clear the set */
      FD_SET(inotifyFd, &set); /* add our file descriptor to the set */
      rv = select(inotifyFd + 1, &set, NULL, NULL, &timeout);
      if(rv==0) report(""); // heartbeat.
    }
    
    int numRead = read(inotifyFd, buffer, kBuffSize);
    if (numRead == 0) {
        std::cerr << "read() from inotify fd returned 0!";
        return 1;
      }
    if (numRead == -1){
        std::cerr << "read() from inotify fd returned -1! Error" << strerror(errno);
        return 1;
    }
    
    char* ptr = buffer;
    
    while(numRead>0) {
      struct inotify_event* event = (struct inotify_event*) ptr;
      
      // if (event->mask & IN_ACCESS)        std::cout << ("IN_ACCESS ");
      // if (event->mask & IN_ATTRIB)        std::cout << ("IN_ATTRIB ");
      // if (event->mask & IN_CLOSE_NOWRITE) std::cout << ("IN_CLOSE_NOWRITE ");
      // if (event->mask & IN_CLOSE_WRITE)   std::cout << ("IN_CLOSE_WRITE ");
      // if (event->mask & IN_CREATE)        std::cout << ("IN_CREATE ");
      // if (event->mask & IN_DELETE)        std::cout << ("IN_DELETE ");
      // if (event->mask & IN_DELETE_SELF)   std::cout << ("IN_DELETE_SELF ");
      // if (event->mask & IN_IGNORED)       std::cout << ("IN_IGNORED ");
      // if (event->mask & IN_ISDIR)         std::cout << ("IN_ISDIR ");
      // if (event->mask & IN_MODIFY)        std::cout << ("IN_MODIFY ");
      // if (event->mask & IN_MOVE_SELF)     std::cout << ("IN_MOVE_SELF ");
      // if (event->mask & IN_MOVED_FROM)    std::cout << ("IN_MOVED_FROM ");
      // if (event->mask & IN_MOVED_TO)      std::cout << ("IN_MOVED_TO ");
      // if (event->mask & IN_OPEN)          std::cout << ("IN_OPEN ");
      // if (event->mask & IN_Q_OVERFLOW)    std::cout << ("IN_Q_OVERFLOW ");
      // if (event->mask & IN_UNMOUNT)       std::cout << ("IN_UNMOUNT ");
      // if(event->len) std::cout << " " << event->name;
      // std::cout << "\n\n";

      if(event->len > 0) {
        std::string name = event->name;
        if(name.rfind(suffix) != std::string::npos) {    
          std::string pathname = dir + name;
          report(pathname);
        }
      }
      
      size_t bytes = sizeof(struct inotify_event) + event->len;
      ptr += bytes;
      numRead -=  bytes;
    } 
  }
}
#endif

/////////////////////////////////////////////////////////////////////////
// Macintosh version: use kqueues
#ifdef __APPLE__
#include <sys/types.h>
#include <sys/event.h>
#include <sys/time.h>
#include <fcntl.h>

std::string flagstring(int flags)
{
    std::string ret;
    std::string orr = "";
 
    if (flags & NOTE_DELETE) {ret+=orr; ret+="NOTE_DELETE";  orr="|";}
    if (flags & NOTE_WRITE)  {ret+=orr; ret+="NOTE_WRITE";   orr="|";}
    if (flags & NOTE_EXTEND) {ret+=orr; ret+="NOTE_EXTEND";  orr="|";}
    if (flags & NOTE_ATTRIB) {ret+=orr; ret+="NOTE_ATTRIB";  orr="|";}
    if (flags & NOTE_LINK)   {ret+=orr; ret+="NOTE_LINK";    orr="|";}
    if (flags & NOTE_RENAME) {ret+=orr; ret+="NOTE_RENAME";  orr="|";}
    if (flags & NOTE_REVOKE) {ret+=orr; ret+="NOTE_REVOKE";  orr="|";}
 
    return ret;
}


int watch_directory_for_new(const std::string& dir, const std::string& suffix, double heartbeat_secs)
{
  int kq;
  int event_fd;
  struct kevent events_to_monitor[1];
  struct kevent event_data[1];
  void *user_data;
  struct timespec timeout;
  unsigned int vnode_events;

  // Open a kernel queue. 
  if ((kq = kqueue()) < 0) {
      fprintf(stderr, "Could not open kernel queue.  Error was %s.\n", strerror(errno));
  }

  // Open a file descriptor for the file/directory that you
  // want to monitor.
       
  event_fd = open(dir.c_str(), O_EVTONLY);
  if (event_fd <=0) {
      fprintf(stderr, "The file %s could not be opened for monitoring.  Error was %s.\n", dir.c_str(), strerror(errno));
      exit(-1);
  }

  // Set the timeout to wake us if we want to do heartbeats.
  timeout.tv_sec = floor(heartbeat_secs);      
  timeout.tv_nsec = fmod(heartbeat_secs,1.0)*1000000000;

  /* Set up a list of events to monitor. */
  vnode_events =   NOTE_WRITE | NOTE_LINK | NOTE_RENAME ;
  EV_SET( &events_to_monitor[0], event_fd, EVFILT_VNODE, EV_ADD | EV_CLEAR, vnode_events, 0, (void*)(dir.c_str()));

  /* Handle events. */
  int num_files = 1;
  while (1) {
      int event_count = kevent(kq, events_to_monitor, 1, event_data, num_files, &timeout);
      if ((event_count < 0) || (event_data[0].flags == EV_ERROR)) {
          /* An error occurred. */
          fprintf(stderr, "An error occurred (event count %d).  The error was %s.\n", event_count, strerror(errno));
          break;
      }
      if (event_count) {
        report(getLastFile(dir,suffix));
          // printf("Event %ld occurred.  Filter %d, flags %d, filter flags %s, filter data %lu , path %s\n",
          //     event_data[0].ident,
          //     event_data[0].filter,
          //     event_data[0].flags,
          //     flagstring(event_data[0].fflags).c_str(),
          //     event_data[0].data,
          //     (char *)event_data[0].udata);
      } else {
        report(""); 
        //printf("No event.\n");
      }

      // Reset the timeout.  In case of a signal interrruption, the values may change.
      timeout.tv_sec = floor(heartbeat_secs);      
      timeout.tv_nsec = fmod(heartbeat_secs,1.0)*1000000000;
  }
  close(event_fd);
  return 0;
}


#endif

/////////////////////////////////////////////////////////////////////////


unsigned long gId = 0;
std::string   gLastFile = "";

void report(const std::string& filename)
{
  if(filename == "") {
    std::cout << "id: " << gId++ << "\n";
    std::cout << "data: " <<  "HEARTBEAT" << "\n\n";
    std::cout.flush();
    return;
  }
  if(filename == gLastFile) return;  // Don't over-report.
  
  std::cout << "id: " << gId++ << "\n";
  std::cout << "data: " <<  filename << "\n\n";
  std::cout.flush();
  gLastFile = filename;
}




int main()
{
  using std::endl;
  using std::cout;
  
  std::cout << "Content-Type: text/event-stream\r\n";
  std::cout << "Cache-Control: no-cache\r\n";
  std::cout << "Connection: keep-alive\r\n";
  std::cout << "\r\n";
  std::cout.flush();
  
  std::string dir = "../live_event_cache/"; // Should be slash-terminated.
  std::string suffix = ".event";
  
  std::vector<std::string> list;
  getFileList(dir,suffix,list);
  for(auto s:list) {
    report(s);
  }
  // while(!list.empty()) {
  //   report(list.back());
  //   list.pop_back();
  // }

  
  // report(getLastFile(dir,suffix));
  

  return watch_directory_for_new(dir,suffix,5);
  
  
}