#include <iostream>
#include <sys/inotify.h>
#include <glob.h>
#include <string>
#include <vector>
#include <unistd.h>
#include <errno.h>
#include <string.h>

std::string getLastFile()
{
  glob_t globbuf;
  globbuf.gl_offs = 0;
  glob("../live_event_cache/*.event",
        0, // flags
        NULL, //errfunc
        &globbuf);
        
  std::string first = globbuf.gl_pathv[0];
  globfree(&globbuf);
  return first;
  
}

int main()
{
  using std::endl;
  using std::cout;
  using std::cerr;
  
  int id =0;
  std::cout << "Content-Type: text/event-stream\r\n";
  std::cout << "Cache-Control: no-cache\r\n";
  std::cout << "\r\n";

  std::string lastfile = getLastFile();
    
  std::cout << "id: " << id++ << "\n";
  std::cout << "data: " <<  lastfile << "\n\n";


  int inotifyFd = inotify_init(); 
  if (inotifyFd == -1) {
      std::cerr << "Error. inotify_init()" << endl;
      return 1;
    }
  
  int wd = inotify_add_watch(inotifyFd, "../live_event_cache/", IN_MOVED_TO|IN_CREATE);
  if (wd == -1) {
      std::cerr << "Error. inotify_init()" << endl;
      return 1;
    }
  
  struct inotify_event* event;
  const size_t kBuffSize = 1024;
  char buffer[kBuffSize];
  
  while(1) {
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
        std::string suffix = ".event";
        std::string name = event->name;
        if(name.rfind(suffix) != std::string::npos) {
          if(name != lastfile) {
            lastfile = name;
    
            std::cout << "id: " << id++ << "\n";
            std::cout << "data: " <<  lastfile << "\n\n";
            
            
          }
        }
      }

      
      size_t bytes = sizeof(struct inotify_event) + event->len;
      ptr += bytes;
      numRead -=  bytes;
    }

    
  }
  
}